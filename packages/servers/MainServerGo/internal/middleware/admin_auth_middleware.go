package middleware

import (
	"slices"
	"sync"

	"github.com/gofiber/fiber/v3"
	"github.com/rpsoftech/DigiGold/MainServerGo/env"
	"github.com/rpsoftech/DigiGold/MainServerGo/interfaces"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/service"
)

const (
	LocalsKeyAdminUUID     = "admin_uuid"
	LocalsKeyAdminRole     = "admin_role"
	LocalsKeyAdminTenantID = "admin_tenant_id"
)

type AdminAuthMiddleware struct {
	jwtService *service.JWTService
}

var (
	adminAuthMiddlewareInstance *AdminAuthMiddleware
	adminAuthMiddlewareOnce     sync.Once
)

// GetAdminAuthMiddleware returns the singleton instance.
func GetAdminAuthMiddleware() *AdminAuthMiddleware {
	adminAuthMiddlewareOnce.Do(func() {
		adminAuthMiddlewareInstance = &AdminAuthMiddleware{
			jwtService: service.GetJWTService(),
		}
	})
	return adminAuthMiddlewareInstance
}

// Intercept validates the admin JWT from the Authorization header and
// injects AdminUUID, Role, and TenantID into Fiber Locals.
func (m *AdminAuthMiddleware) Intercept(c fiber.Ctx) error {
	authHeader := c.Get(env.XApiToken)
	if authHeader == "" {
		return &interfaces.RequestError{
			StatusCode: fiber.StatusUnauthorized,
			Code:       interfaces.ERROR_TOKEN_NOT_PASSED,
			Message:    "Missing Authorization header",
		}
	}

	claims, err := m.jwtService.ValidateAdminToken(authHeader)
	if err != nil {
		return &interfaces.RequestError{
			StatusCode: fiber.StatusUnauthorized,
			Code:       interfaces.ERROR_INVALID_TOKEN,
			Message:    "Invalid or expired admin token",
		}
	}

	c.Locals(LocalsKeyAdminUUID, claims.AdminUUID)
	c.Locals(LocalsKeyAdminRole, claims.Role)
	c.Locals(LocalsKeyAdminTenantID, claims.TenantID)

	return c.Next()
}

// RequireRole is a secondary guard that can be chained after Intercept to
// restrict an endpoint to specific roles (e.g. "super_admin").
func RequireRole(roles ...string) fiber.Handler {
	return func(c fiber.Ctx) error {
		adminRole, _ := c.Locals(LocalsKeyAdminRole).(string)
		if slices.Contains(roles, adminRole) {
			return c.Next()
		}
		return &interfaces.RequestError{
			StatusCode: fiber.StatusForbidden,
			Code:       interfaces.ERROR_ROLE_NOT_AUTHORIZED,
			Message:    "Insufficient permissions for this action",
		}
	}
}

// ==========================================
// LOCALS EXTRACTION HELPERS (For Controllers)
// ==========================================

func GetAdminUUID(c fiber.Ctx) string {
	uuid, _ := c.Locals(LocalsKeyAdminUUID).(string)
	return uuid
}

func GetAdminRole(c fiber.Ctx) string {
	role, _ := c.Locals(LocalsKeyAdminRole).(string)
	return role
}

func GetAdminTenantID(c fiber.Ctx) int64 {
	id, _ := c.Locals(LocalsKeyAdminTenantID).(int64)
	return id
}

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

	// Roles (must match the tu_role CHECK constraint in the schema)
	RoleSuperAdmin = "super_admin"
	RoleManager    = "manager"
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

	// Enforce tenant isolation: a store admin may only act on the tenant that
	// issued their token. Only the platform-level super_admin may act on the
	// tenant named in X-Tenant-ID. TenantInterceptor must run before this.
	requestTenantID := GetTenantIntID(c)
	if requestTenantID == 0 {
		return &interfaces.RequestError{
			StatusCode: fiber.StatusBadRequest,
			Code:       interfaces.ERROR_INVALID_INPUT,
			Message:    "Missing tenant context. Ensure TenantInterceptor is applied.",
			Name:       "MISSING_TENANT",
		}
	}
	if claims.Role != RoleSuperAdmin && claims.TenantID != requestTenantID {
		return &interfaces.RequestError{
			StatusCode: fiber.StatusForbidden,
			Code:       interfaces.ERROR_ROLE_NOT_AUTHORIZED,
			Message:    "Tenant mismatch. Access denied.",
			Name:       "TENANT_MISMATCH",
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

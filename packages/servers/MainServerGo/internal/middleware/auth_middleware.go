package middleware

import (
	"errors"
	"sync"

	"github.com/gofiber/fiber/v3"
	"github.com/rpsoftech/DigiGold/MainServerGo/env"
	"github.com/rpsoftech/DigiGold/MainServerGo/interfaces"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/service"
)

const (
	LocalsKeyUserUUID  = "user_uuid"
	LocalsKeyUserPhone = "user_phone"
)

// 1. Define the Struct
type AuthMiddleware struct {
	jwtService *service.JWTService // Injected Dependency
}

var (
	authMiddlewareInstance *AuthMiddleware
	authMiddlewareOnce     sync.Once
)

// 2. Thread-Safe Lazy Initialization
func GetAuthMiddleware() *AuthMiddleware {
	authMiddlewareOnce.Do(func() {
		authMiddlewareInstance = &AuthMiddleware{
			// Inject the dependency exactly once on boot
			jwtService: service.GetJWTService(),
		}
	})
	return authMiddlewareInstance
}

// 3. The actual Fiber Handler Method
func (m *AuthMiddleware) Intercept(c fiber.Ctx) error {
	authHeader := c.Get(env.XApiToken)
	if authHeader == "" {
		return &interfaces.RequestError{
			StatusCode: fiber.StatusUnauthorized,
			Code:       interfaces.ERROR_TOKEN_NOT_PASSED,
			Message:    "Missing Authorization header",
		}
	}

	if len(authHeader) < 10 {
		return &interfaces.RequestError{
			StatusCode: fiber.StatusUnauthorized,
			Code:       interfaces.ERROR_TOKEN_NOT_PASSED,
			Message:    "Invalid Authorization header format",
		}
	}

	// 4. ZERO-OVERHEAD LOOKUP: We use the injected pointer directly!
	claims, err := m.jwtService.ValidateAccessToken(authHeader)
	if err != nil {
		if errors.Is(err, interfaces.ErrTokenExpired) {
			return &interfaces.RequestError{
				StatusCode: fiber.StatusUnauthorized,
				Code:       interfaces.ERROR_TOKEN_EXPIRED,
				Message:    "Token has expired",
			}
		}
		return &interfaces.RequestError{
			StatusCode: fiber.StatusUnauthorized,
			Code:       interfaces.ERROR_INVALID_TOKEN,
			Message:    "Invalid or malformed token",
		}
	}

	// 4. Enforce Tenant Isolation
	// The TenantInterceptor must run BEFORE this middleware to inject the tenant UUID
	requestTenantUUID := GetTenantUUID(c)
	if requestTenantUUID == "" {
		return &interfaces.RequestError{
			StatusCode: fiber.StatusBadRequest,
			Code:       interfaces.ERROR_INVALID_INPUT,
			Message:    "Missing tenant context. Ensure TenantInterceptor is applied.",
			Name:       "MISSING_TENANT",
		}
	}

	if claims.TenantUUID != requestTenantUUID {
		return &interfaces.RequestError{
			StatusCode: fiber.StatusForbidden,
			Code:       interfaces.ERROR_INVALID_TOKEN, // Or ERROR_FORBIDDEN
			Message:    "Tenant mismatch. Access denied.",
			Name:       "TENANT_MISMATCH",
		}
	}

	// 5. Inject User Details into Locals
	c.Locals(LocalsKeyUserUUID, claims.UserUUID)
	c.Locals(LocalsKeyUserPhone, claims.Phone)

	return c.Next()
}

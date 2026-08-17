package middleware

import (
	"github.com/gofiber/fiber/v3"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/repository"
)

const (
	LocalsKeyTenantIntID = "tenant_int_id"
	LocalsKeyTenantUUID  = "tenant_uuid"
)

// TenantInterceptor is the mandatory Front Door for all tenant-specific API routes
func TenantInterceptor(c fiber.Ctx) error {
	// 1. Extract the public UUID from the Headers
	tenantUUID := c.Get("X-Tenant-ID")
	if tenantUUID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   "Missing X-Tenant-ID header",
		})
	}

	// 2. Translate UUID to Internal int64 ID (Using our cached RWMutex repo)
	tenantRepo := repository.GetTenantRepository()

	// CRITICAL: We use c.UserContext() to pass a standard context.Context to the database
	tenantIntID, err := tenantRepo.TenantUUIDtoID(c.Context(), tenantUUID)

	if err != nil || tenantIntID == 0 {
		// Do not leak database errors to the frontend; just deny access.
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"error":   "Invalid or suspended Tenant API Key",
		})
	}

	// 3. Inject into Fiber's high-performance Locals
	c.Locals(LocalsKeyTenantIntID, tenantIntID)
	c.Locals(LocalsKeyTenantUUID, tenantUUID)

	// 4. Proceed to the Controller
	return c.Next()
}

// ==========================================
// LOCALS EXTRACTION HELPERS (For Controllers)
// ==========================================

func GetTenantIntID(c fiber.Ctx) int64 {
	id, _ := c.Locals(LocalsKeyTenantIntID).(int64)
	return id
}

func GetTenantUUID(c fiber.Ctx) string {
	uuid, _ := c.Locals(LocalsKeyTenantUUID).(string)
	return uuid
}

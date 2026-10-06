package tenant

import (
	"github.com/gofiber/fiber/v3"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/middleware"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/service"
)

type TenantController struct {
	tenantConfigService *service.TenantConfigService
}

func NewTenantController() *TenantController {
	return &TenantController{
		tenantConfigService: service.GetTenantConfigService(),
	}
}

func (c *TenantController) RegisterRoutes(router fiber.Router) {
	// Public Tenant Info route
	// The TenantInterceptor will read X-Tenant-Id or Host header and set Local("tenant_uuid")
	tenantGroup := router.Group("/tenant", middleware.TenantInterceptor)
	tenantGroup.Get("/info", c.GetPublicTenantInfo)
}

func (c *TenantController) GetPublicTenantInfo(ctx fiber.Ctx) error {
	tenantUUID := middleware.GetTenantUUID(ctx)

	// Fetch the full tenant from the cache/DB
	tenant, err := c.tenantConfigService.GetTenantByUUID(ctx.Context(), tenantUUID)
	if err != nil {
		return ctx.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "tenant not found"})
	}

	// Only return public-safe fields (NO renewal cost, NO domain expiry, etc.)
	return ctx.JSON(fiber.Map{
		"tenant_uuid":    tenant.UUID,
		"full_name":      tenant.FullName,
		"short_name":     tenant.ShortName,
		"domain":         tenant.Domain,
		"subdomain":      tenant.Subdomain,
		"kyc_mode":       tenant.KYCMode,
		"ui_json_config": tenant.UIJSONConfig,
	})
}

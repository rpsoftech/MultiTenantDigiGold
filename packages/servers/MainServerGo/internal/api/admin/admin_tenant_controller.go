package admin

import (
	"github.com/gofiber/fiber/v3"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/models"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/service"
)

type AdminTenantController struct {
	tenantConfigService *service.TenantConfigService
}

func NewAdminTenantController() *AdminTenantController {
	return &AdminTenantController{
		tenantConfigService: service.GetTenantConfigService(),
	}
}

func (c *AdminTenantController) RegisterRoutes(router fiber.Router) {
	tenantsGroup := router.Group("/tenants")

	// Stage 1: Stub
	tenantsGroup.Post("/stub", c.CreateStub)

	// Stage 2: Profile
	tenantsGroup.Patch("/:uuid/profile", c.UpdateProfile)

	// Stage 3: Config
	tenantsGroup.Patch("/:uuid/config", c.UpdateConfig)

	// Stage 4: Margins
	tenantsGroup.Patch("/:uuid/margins", c.UpdateMargins)

	// Stage 5: KYC Add
	tenantsGroup.Post("/:uuid/kyc", c.AddKYC)

	// Stage 6: KYC Verify
	tenantsGroup.Patch("/:uuid/kyc/verify", c.VerifyKYC)

	// Stage 7: Status/Launch
	tenantsGroup.Patch("/:uuid/status", c.UpdateStatus)
}

func getAdminUUID(ctx fiber.Ctx) string {
	uuid, ok := ctx.Locals("admin_uuid").(string)
	if !ok || uuid == "" {
		// Fallback for testing, in production this should strictly come from JWT
		uuid = "SYSTEM_ADMIN"
	}
	return uuid
}

type CreateStubRequest struct {
	Tenant    models.Tenant          `json:"tenant"`
	AdminUser models.TenantUserLogin `json:"admin_user"`
}

func (c *AdminTenantController) CreateStub(ctx fiber.Ctx) error {
	var req CreateStubRequest
	if err := ctx.Bind().Body(&req); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	adminUUID := getAdminUUID(ctx)

	if err := c.tenantConfigService.CreateTenant(ctx.Context(), &req.Tenant, &req.AdminUser, adminUUID); err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return ctx.JSON(fiber.Map{"status": "success", "tenant_uuid": req.Tenant.UUID})
}

func (c *AdminTenantController) UpdateProfile(ctx fiber.Ctx) error {
	var tenant models.Tenant
	if err := ctx.Bind().Body(&tenant); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	tenant.UUID = ctx.Params("uuid")
	adminUUID := getAdminUUID(ctx)

	if err := c.tenantConfigService.UpdateTenantProfile(ctx.Context(), &tenant, adminUUID); err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return ctx.JSON(fiber.Map{"status": "success"})
}

func (c *AdminTenantController) UpdateConfig(ctx fiber.Ctx) error {
	var config models.TenantInternalConfig
	if err := ctx.Bind().Body(&config); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	tenantUUID := ctx.Params("uuid")
	adminUUID := getAdminUUID(ctx)

	if err := c.tenantConfigService.UpdateTenantConfig(ctx.Context(), &config, adminUUID, tenantUUID); err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return ctx.JSON(fiber.Map{"status": "success"})
}

func (c *AdminTenantController) UpdateMargins(ctx fiber.Ctx) error {
	var margin models.MarginConfig
	if err := ctx.Bind().Body(&margin); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	tenantUUID := ctx.Params("uuid")
	adminUUID := getAdminUUID(ctx)

	if err := c.tenantConfigService.UpdateTenantMargins(ctx.Context(), &margin, adminUUID, tenantUUID); err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return ctx.JSON(fiber.Map{"status": "success"})
}

func (c *AdminTenantController) AddKYC(ctx fiber.Ctx) error {
	var kycDoc models.TenantKYCDocument
	if err := ctx.Bind().Body(&kycDoc); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	tenantUUID := ctx.Params("uuid")
	adminUUID := getAdminUUID(ctx)

	if err := c.tenantConfigService.UpdateTenantKYCAdd(ctx.Context(), &kycDoc, adminUUID, tenantUUID); err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return ctx.JSON(fiber.Map{"status": "success", "tkd_uuid": kycDoc.UUID})
}

func (c *AdminTenantController) VerifyKYC(ctx fiber.Ctx) error {
	var kycDoc models.TenantKYCDocument
	if err := ctx.Bind().Body(&kycDoc); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	tenantUUID := ctx.Params("uuid")
	adminUUID := getAdminUUID(ctx)
	kycDoc.VerifiedBy = adminUUID

	if err := c.tenantConfigService.UpdateTenantKYCVerify(ctx.Context(), &kycDoc, adminUUID, tenantUUID); err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return ctx.JSON(fiber.Map{"status": "success"})
}

func (c *AdminTenantController) UpdateStatus(ctx fiber.Ctx) error {
	var tenant models.Tenant
	if err := ctx.Bind().Body(&tenant); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	tenant.UUID = ctx.Params("uuid")
	adminUUID := getAdminUUID(ctx)

	if err := c.tenantConfigService.UpdateTenantStatus(ctx.Context(), &tenant, adminUUID); err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return ctx.JSON(fiber.Map{"status": "success"})
}

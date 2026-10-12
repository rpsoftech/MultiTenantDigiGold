package admin

import (
	"encoding/json"
	"strconv"

	"github.com/gofiber/fiber/v3"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/middleware"
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
	// All tenant management routes:
	//   - TenantInterceptor   → reads X-Tenant-ID header, resolves UUID→int64, injects into Locals
	//   - AdminJWTMiddleware  → validates AdminClaims JWT, injects admin_uuid/role/tenant_id into Locals
	// Only super_admin may manage tenants.
	am := middleware.GetAdminAuthMiddleware()
	tenantsGroup := router.Group("/tenants",
		middleware.TenantInterceptor,
		am.Intercept,
		middleware.RequireRole("super_admin"),
	)
	// Phase B: Read Operations
	tenantsGroup.Get("/", c.GetTenantsList)
	tenantsGroup.Get("/:uuid", c.GetTenantDetail)
	tenantsGroup.Get("/:uuid/margins", c.GetTenantMargins)
	tenantsGroup.Get("/:uuid/kyc", c.GetTenantKYC)

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

	// Stage 8: UI Layout
	tenantsGroup.Patch("/:uuid/ui-layout", c.UpdateUILayout)
}

// CreateStubRequest is a new store and its root admin. The admin's password is taken here
// (models.TenantUserLogin never decodes one) and stored only as a bcrypt hash.
type CreateStubRequest struct {
	Tenant    models.Tenant `json:"tenant"`
	AdminUser struct {
		Username    string `json:"username"`
		PhoneNumber string `json:"phone_number"`
		Password    string `json:"password"`
	} `json:"admin_user"`
}

// CreateStub — Stage 1
// X-Tenant-ID header is the MASTER tenant UUID (Tier-1), which the TenantInterceptor
// resolves to an int64. The new sub-tenant being created lives entirely in req.Tenant.
func (c *AdminTenantController) CreateStub(ctx fiber.Ctx) error {
	var req CreateStubRequest
	if err := ctx.Bind().Body(&req); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	adminUUID := middleware.GetAdminUUID(ctx)

	storeAdmin, err := c.tenantConfigService.CreateTenant(ctx.Context(), &req.Tenant, service.StoreAdminInput{
		Username:    req.AdminUser.Username,
		PhoneNumber: req.AdminUser.PhoneNumber,
		Password:    req.AdminUser.Password,
	}, adminUUID)
	if err != nil {
		return err
	}

	return ctx.Status(fiber.StatusCreated).JSON(fiber.Map{
		"status":      "success",
		"tenant_uuid": req.Tenant.UUID,
		"admin_uuid":  storeAdmin.UUID,
	})
}

// UpdateProfile — Stage 2
// :uuid in the path is the TARGET tenant's UUID.
// TenantInterceptor resolves the master tenant from X-Tenant-ID; the path param
// is passed directly to the service which does its own UUID-based UPDATE.
//
// The request is applied on top of the current row, so a field the admin leaves out keeps
// its value. (Binding into an empty Tenant used to clear every omitted column, including
// the storefront layout.) The active flag is changed only through UpdateStatus.
func (c *AdminTenantController) UpdateProfile(ctx fiber.Ctx) error {
	tenantUUID := ctx.Params("uuid")
	current, err := c.tenantConfigService.GetTenantByUUID(ctx.Context(), tenantUUID)
	if err != nil {
		return err
	}
	previous := *current

	updated := *current
	if err := json.Unmarshal(ctx.Body(), &updated); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}
	updated.ID = current.ID
	updated.ExportID = 0
	updated.UUID = tenantUUID
	updated.IsActive = current.IsActive
	updated.CreatedAt = current.CreatedAt

	adminUUID := middleware.GetAdminUUID(ctx)
	if err := c.tenantConfigService.UpdateTenantProfile(ctx.Context(), &updated, &previous, adminUUID); err != nil {
		return err
	}

	return ctx.JSON(fiber.Map{"status": "success"})
}

// UpdateConfig — Stage 3
func (c *AdminTenantController) UpdateConfig(ctx fiber.Ctx) error {
	var config models.TenantInternalConfig
	if err := ctx.Bind().Body(&config); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	tenantUUID := ctx.Params("uuid")
	adminUUID := middleware.GetAdminUUID(ctx)

	if err := c.tenantConfigService.UpdateTenantConfig(ctx.Context(), &config, adminUUID, tenantUUID); err != nil {
		return err
	}

	return ctx.JSON(fiber.Map{"status": "success"})
}

// UpdateMargins — Stage 4
// MarginRepo uses tenant_id (int64) internally for the SELECT FOR UPDATE.
// We resolve UUID → int64 via TenantInterceptor using the path param UUID.
func (c *AdminTenantController) UpdateMargins(ctx fiber.Ctx) error {
	var margin models.MarginConfig
	if err := ctx.Bind().Body(&margin); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	tenantUUID := ctx.Params("uuid")
	adminUUID := middleware.GetAdminUUID(ctx)

	if err := c.tenantConfigService.UpdateTenantMargins(ctx.Context(), &margin, adminUUID, tenantUUID); err != nil {
		return err
	}

	return ctx.JSON(fiber.Map{"status": "success"})
}

// AddKYC — Stage 5
func (c *AdminTenantController) AddKYC(ctx fiber.Ctx) error {
	var kycDoc models.TenantKYCDocument
	if err := ctx.Bind().Body(&kycDoc); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	tenantUUID := ctx.Params("uuid")
	adminUUID := middleware.GetAdminUUID(ctx)

	if err := c.tenantConfigService.UpdateTenantKYCAdd(ctx.Context(), &kycDoc, adminUUID, tenantUUID); err != nil {
		return err
	}

	return ctx.Status(fiber.StatusCreated).JSON(fiber.Map{
		"status":   "success",
		"tkd_uuid": kycDoc.UUID,
	})
}

// VerifyKYC — Stage 6
func (c *AdminTenantController) VerifyKYC(ctx fiber.Ctx) error {
	var kycDoc models.TenantKYCDocument
	if err := ctx.Bind().Body(&kycDoc); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	tenantUUID := ctx.Params("uuid")
	adminUUID := middleware.GetAdminUUID(ctx)
	kycDoc.VerifiedBy = adminUUID

	if err := c.tenantConfigService.UpdateTenantKYCVerify(ctx.Context(), &kycDoc, adminUUID, tenantUUID); err != nil {
		return err
	}

	return ctx.JSON(fiber.Map{"status": "success"})
}

// UpdateStatusRequest suspends ({"is_active": false}) or reactivates a store.
type UpdateStatusRequest struct {
	IsActive *bool `json:"is_active"`
}

// UpdateStatus — Stage 7. Changes only the store's active flag. It used to bind a whole
// Tenant and overwrite every column with whatever the body held.
func (c *AdminTenantController) UpdateStatus(ctx fiber.Ctx) error {
	var req UpdateStatusRequest
	if err := ctx.Bind().Body(&req); err != nil || req.IsActive == nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "is_active (true or false) is required"})
	}

	adminUUID := middleware.GetAdminUUID(ctx)
	tenant, err := c.tenantConfigService.UpdateTenantStatus(ctx.Context(), ctx.Params("uuid"), *req.IsActive, adminUUID)
	if err != nil {
		return err
	}

	return ctx.JSON(fiber.Map{"status": "success", "is_active": tenant.IsActive})
}

// ==========================================
// Phase B: READ HANDLERS
// ==========================================

func (c *AdminTenantController) GetTenantsList(ctx fiber.Ctx) error {
	pageStr := ctx.Query("page", "1")
	limitStr := ctx.Query("limit", "20")

	page, _ := strconv.Atoi(pageStr)
	limit, _ := strconv.Atoi(limitStr)

	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}

	tenants, total, err := c.tenantConfigService.GetTenantsPaginated(ctx.Context(), page, limit)
	if err != nil {
		return err
	}

	return ctx.JSON(fiber.Map{
		"data":  tenants,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

func (c *AdminTenantController) GetTenantDetail(ctx fiber.Ctx) error {
	uuid := ctx.Params("uuid")
	tenant, err := c.tenantConfigService.GetTenantByUUID(ctx.Context(), uuid)
	if err != nil {
		return err
	}

	return ctx.JSON(fiber.Map{
		"data": tenant,
	})
}

func (c *AdminTenantController) GetTenantMargins(ctx fiber.Ctx) error {
	uuid := ctx.Params("uuid")
	margins, err := c.tenantConfigService.GetTenantMargins(ctx.Context(), uuid)
	if err != nil {
		return err
	}

	return ctx.JSON(fiber.Map{
		"data": margins,
	})
}

func (c *AdminTenantController) GetTenantKYC(ctx fiber.Ctx) error {
	uuid := ctx.Params("uuid")
	docs, err := c.tenantConfigService.GetTenantKYC(ctx.Context(), uuid)
	if err != nil {
		return err
	}

	return ctx.JSON(fiber.Map{
		"data": docs,
	})
}

// UpdateUILayout — Stage 8
func (c *AdminTenantController) UpdateUILayout(ctx fiber.Ctx) error {
	var req struct {
		UIJSONConfig []interface{} `json:"ui_json_config"`
	}
	if err := ctx.Bind().Body(&req); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	tenantUUID := ctx.Params("uuid")
	adminUUID := middleware.GetAdminUUID(ctx)

	if err := c.tenantConfigService.UpdateTenantUILayout(ctx.Context(), tenantUUID, req.UIJSONConfig, adminUUID); err != nil {
		return err
	}

	return ctx.JSON(fiber.Map{"status": "success"})
}

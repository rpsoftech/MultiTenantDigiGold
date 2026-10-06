package admin

import (
	"golang.org/x/crypto/bcrypt"
	"strconv"

	"github.com/gofiber/fiber/v3"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/middleware"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/models"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/service"
	utility_functions "github.com/rpsoftech/DigiGold/MainServerGo/utility/functions"
)

type AdminUserController struct {
	adminUserService *service.AdminUserService
	tenantRepo       *service.TenantConfigService // to get TenantID from UUID easily
}

func NewAdminUserController() *AdminUserController {
	return &AdminUserController{
		adminUserService: service.GetAdminUserService(),
		tenantRepo:       service.GetTenantConfigService(), // Or just use TenantRepository
	}
}

func (c *AdminUserController) RegisterRoutes(router fiber.Router) {
	am := middleware.GetAdminAuthMiddleware()
	adminsGroup := router.Group("/admins",
		middleware.TenantInterceptor,
		am.Intercept,
		middleware.RequireRole("super_admin"),
	)

	adminsGroup.Get("/", c.GetAdminsList)
	adminsGroup.Get("/:uuid", c.GetAdminDetail)
	adminsGroup.Post("/", c.CreateAdmin)
	adminsGroup.Patch("/:uuid", c.UpdateAdmin)
}

func (c *AdminUserController) GetAdminsList(ctx fiber.Ctx) error {
	pageStr := ctx.Query("page", "1")
	limitStr := ctx.Query("limit", "20")
	tenantUUID := ctx.Query("tenant_uuid", "") // Optional filter

	page, _ := strconv.Atoi(pageStr)
	limit, _ := strconv.Atoi(limitStr)

	admins, total, err := c.adminUserService.GetAdminsPaginated(ctx.Context(), tenantUUID, page, limit)
	if err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return ctx.JSON(fiber.Map{
		"data":  admins,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

func (c *AdminUserController) GetAdminDetail(ctx fiber.Ctx) error {
	adminUUID := ctx.Params("uuid")
	tenantUUID := ctx.Query("tenant_uuid", "") // Require passing tenant UUID to fetch admin?
	if tenantUUID == "" {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "tenant_uuid query param is required"})
	}

	admin, err := c.adminUserService.GetAdminByUUID(ctx.Context(), tenantUUID, adminUUID)
	if err != nil {
		return ctx.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
	}

	return ctx.JSON(fiber.Map{"data": admin})
}

type CreateAdminRequest struct {
	TenantUUID  string `json:"tenant_uuid"`
	Username    string `json:"username"`
	PhoneNumber string `json:"phone_number"`
	Password    string `json:"password"`
	Role        string `json:"role"`
}

func (c *AdminUserController) CreateAdmin(ctx fiber.Ctx) error {
	var req CreateAdminRequest
	if err := ctx.Bind().Body(&req); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	tenant, err := c.tenantRepo.GetTenantByUUID(ctx.Context(), req.TenantUUID)
	if err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid tenant uuid"})
	}

	hashBytes, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to hash password"})
	}
	hash := string(hashBytes)

	admin := &models.TenantUserLogin{
		UUID:            utility_functions.GenerateNewUUID(),
		TenantID:        tenant.ID,
		Username:        req.Username,
		PhoneNumber:     req.PhoneNumber,
		PasswordHash:    hash,
		Role:            req.Role,
		IsActive:        true,
		IsTOTPEnabled:   false,
		PermissionsJSON: []byte("{}"),
	}

	masterAdminUUID := middleware.GetAdminUUID(ctx)
	if err := c.adminUserService.CreateAdmin(ctx.Context(), admin, masterAdminUUID); err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return ctx.Status(fiber.StatusCreated).JSON(fiber.Map{"data": admin})
}

type UpdateAdminRequest struct {
	TenantUUID string `json:"tenant_uuid"`
	IsActive   *bool  `json:"is_active,omitempty"`
	ResetTOTP  *bool  `json:"reset_totp,omitempty"`
	Role       string `json:"role,omitempty"`
}

func (c *AdminUserController) UpdateAdmin(ctx fiber.Ctx) error {
	adminUUID := ctx.Params("uuid")
	var req UpdateAdminRequest
	if err := ctx.Bind().Body(&req); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	if req.TenantUUID == "" {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "tenant_uuid is required in body"})
	}

	admin, err := c.adminUserService.GetAdminByUUID(ctx.Context(), req.TenantUUID, adminUUID)
	if err != nil {
		return ctx.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "admin not found"})
	}

	if req.IsActive != nil {
		admin.IsActive = *req.IsActive
	}
	if req.Role != "" {
		admin.Role = req.Role
	}
	if req.ResetTOTP != nil && *req.ResetTOTP {
		admin.IsTOTPEnabled = false
		admin.TOTPSecret = ""
	}

	masterAdminUUID := middleware.GetAdminUUID(ctx)
	if err := c.adminUserService.UpdateAdmin(ctx.Context(), admin, masterAdminUUID); err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return ctx.JSON(fiber.Map{"data": admin})
}

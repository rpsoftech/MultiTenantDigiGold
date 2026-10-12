package admin

import (
	"fmt"
	"strconv"
	"strings"

	"golang.org/x/crypto/bcrypt"

	"github.com/gofiber/fiber/v3"
	"github.com/rpsoftech/DigiGold/MainServerGo/interfaces"
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

// Platform admins (super_admin) manage staff of any store. A store's managers manage their
// own store's staff: the store is the one their token and X-Tenant-ID name, they can only
// give the manager role, and they can't touch a super_admin.
func (c *AdminUserController) RegisterRoutes(router fiber.Router) {
	am := middleware.GetAdminAuthMiddleware()
	adminsGroup := router.Group("/admins",
		middleware.TenantInterceptor,
		am.Intercept,
		middleware.RequireRole(middleware.RoleSuperAdmin, middleware.RoleManager),
	)

	adminsGroup.Get("/", c.GetAdminsList)
	adminsGroup.Get("/:uuid", c.GetAdminDetail)
	adminsGroup.Post("/", c.CreateAdmin)
	adminsGroup.Patch("/:uuid", c.UpdateAdmin)
}

var (
	errOtherStoresStaff = &interfaces.RequestError{
		StatusCode: fiber.StatusForbidden,
		Code:       interfaces.ERROR_ROLE_NOT_AUTHORIZED,
		Name:       "TENANT_MISMATCH",
		Message:    "Managers can only manage their own store's staff.",
	}
	errSuperAdminOnly = &interfaces.RequestError{
		StatusCode: fiber.StatusForbidden,
		Code:       interfaces.ERROR_ROLE_NOT_AUTHORIZED,
		Name:       "ROLE_NOT_AUTHORIZED",
		Message:    "Only a platform admin can create or change a super_admin.",
	}
	errChangeOwnAccount = &interfaces.RequestError{
		StatusCode: fiber.StatusBadRequest,
		Code:       interfaces.ERROR_INVALID_INPUT,
		Name:       "CANNOT_CHANGE_OWN_ACCOUNT",
		Message:    "You can't deactivate your own account or change your own role.",
	}
)

func isSuperAdmin(ctx fiber.Ctx) bool {
	return middleware.GetAdminRole(ctx) == middleware.RoleSuperAdmin
}

// staffTenantUUID is the store a request may manage staff of. A super_admin names it
// (requested, may be empty where optional); a manager always gets their own store, which
// AdminAuthMiddleware has already matched to X-Tenant-ID, and naming another is refused.
func staffTenantUUID(ctx fiber.Ctx, requested string) (string, error) {
	if isSuperAdmin(ctx) {
		return requested, nil
	}
	own := middleware.GetTenantUUID(ctx)
	if requested != "" && requested != own {
		return "", errOtherStoresStaff
	}
	return own, nil
}

func (c *AdminUserController) GetAdminsList(ctx fiber.Ctx) error {
	pageStr := ctx.Query("page", "1")
	limitStr := ctx.Query("limit", "20")
	tenantUUID, err := staffTenantUUID(ctx, ctx.Query("tenant_uuid", "")) // optional for super_admin
	if err != nil {
		return err
	}

	page, _ := strconv.Atoi(pageStr)
	limit, _ := strconv.Atoi(limitStr)
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}

	// Errors go to GlobalErrorHandler: a server fault becomes a generic 500 (reported to
	// monitoring) instead of the raw database error text.
	admins, total, err := c.adminUserService.GetAdminsPaginated(ctx.Context(), tenantUUID, page, limit)
	if err != nil {
		return err
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
	tenantUUID, err := staffTenantUUID(ctx, ctx.Query("tenant_uuid", ""))
	if err != nil {
		return err
	}
	if tenantUUID == "" {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "tenant_uuid query param is required"})
	}

	admin, err := c.adminUserService.GetAdminByUUID(ctx.Context(), tenantUUID, adminUUID)
	if err != nil {
		return err
	}

	return ctx.JSON(fiber.Map{"data": admin})
}

// assignableRoles are the roles an admin can be given. "custom" exists in the schema but no
// route accepts it yet, so an admin given it could sign in to nothing.
var assignableRoles = map[string]bool{middleware.RoleManager: true, middleware.RoleSuperAdmin: true}

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

	req.Username = strings.TrimSpace(req.Username)
	req.PhoneNumber = strings.TrimSpace(req.PhoneNumber)
	if req.Username == "" || req.PhoneNumber == "" {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "username and phone_number are required"})
	}
	if !assignableRoles[req.Role] {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "role must be manager or super_admin"})
	}
	if req.Role == middleware.RoleSuperAdmin && !isSuperAdmin(ctx) {
		return errSuperAdminOnly
	}
	if err := service.ValidateAdminPassword(req.Password); err != nil {
		return err
	}
	tenantUUID, err := staffTenantUUID(ctx, req.TenantUUID)
	if err != nil {
		return err
	}

	tenant, err := c.tenantRepo.GetTenantByUUID(ctx.Context(), tenantUUID)
	if err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid tenant uuid"})
	}

	hashBytes, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash admin password: %w", err)
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
		return err
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

	tenantUUID, err := staffTenantUUID(ctx, req.TenantUUID)
	if err != nil {
		return err
	}
	if tenantUUID == "" {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "tenant_uuid is required in body"})
	}

	admin, err := c.adminUserService.GetAdminByUUID(ctx.Context(), tenantUUID, adminUUID)
	if err != nil {
		return ctx.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "admin not found"})
	}
	if admin.Role == middleware.RoleSuperAdmin && !isSuperAdmin(ctx) {
		return errSuperAdminOnly
	}
	// Nobody can lock themselves out: deactivating your own account or changing your own
	// role is refused (another admin can do it).
	isSelf := admin.UUID == middleware.GetAdminUUID(ctx)
	if isSelf && ((req.IsActive != nil && !*req.IsActive) || (req.Role != "" && req.Role != admin.Role)) {
		return errChangeOwnAccount
	}

	if req.IsActive != nil {
		admin.IsActive = *req.IsActive
	}
	if req.Role != "" {
		if !assignableRoles[req.Role] {
			return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "role must be manager or super_admin"})
		}
		if req.Role == middleware.RoleSuperAdmin && !isSuperAdmin(ctx) {
			return errSuperAdminOnly
		}
		admin.Role = req.Role
	}
	if req.ResetTOTP != nil && *req.ResetTOTP {
		admin.IsTOTPEnabled = false
		admin.TOTPSecret = ""
	}

	masterAdminUUID := middleware.GetAdminUUID(ctx)
	if err := c.adminUserService.UpdateAdmin(ctx.Context(), admin, masterAdminUUID); err != nil {
		return err
	}

	return ctx.JSON(fiber.Map{"data": admin})
}

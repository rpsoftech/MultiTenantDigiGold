package admin

import (
	"github.com/gofiber/fiber/v3"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/middleware"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/service"
)

type AdminAuthController struct {
	adminAuthService *service.AdminAuthService
}

func NewAdminAuthController() *AdminAuthController {
	return &AdminAuthController{
		adminAuthService: service.InitAdminAuthService(),
	}
}

func (c *AdminAuthController) RegisterRoutes(router fiber.Router) {
	// TenantInterceptor resolves X-Tenant-ID UUID → int64 for all auth routes.
	// No JWT required here — this IS the login flow.
	authGroup := router.Group("/auth", middleware.AuthRateLimiter(), middleware.TenantInterceptor)
	authGroup.Post("/login", c.Login)
	authGroup.Post("/totp/setup", c.TOTPSetup)
	authGroup.Post("/totp/verify", c.TOTPVerify)
	authGroup.Post("/refresh", c.Refresh)
}

type AdminLoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

func (c *AdminAuthController) Login(ctx fiber.Ctx) error {
	var req AdminLoginRequest
	if err := ctx.Bind().Body(&req); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	// Tenant resolved from X-Tenant-ID header by TenantInterceptor — never from JSON body.
	tenantID := middleware.GetTenantIntID(ctx)

	tempToken, err := c.adminAuthService.AdminLogin(ctx.Context(), tenantID, req.Username, req.Password)
	if err != nil {
		return err
	}

	return ctx.JSON(fiber.Map{
		"temp_token": tempToken,
	})
}

type TOTPSetupRequest struct {
	TempToken string `json:"temp_token"`
}

func (c *AdminAuthController) TOTPSetup(ctx fiber.Ctx) error {
	var req TOTPSetupRequest
	if err := ctx.Bind().Body(&req); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	_, uri, err := c.adminAuthService.SetupTOTP(ctx.Context(), req.TempToken)
	if err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	return ctx.JSON(fiber.Map{
		"otpauth_uri": uri,
	})
}

type TOTPVerifyRequest struct {
	TempToken string `json:"temp_token"`
	Code      string `json:"code"`
}

func (c *AdminAuthController) TOTPVerify(ctx fiber.Ctx) error {
	var req TOTPVerifyRequest
	if err := ctx.Bind().Body(&req); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	clientIP := ctx.IP()
	accessToken, refreshToken, err := c.adminAuthService.VerifyTOTP(ctx.Context(), req.TempToken, req.Code, clientIP)
	if err != nil {
		return ctx.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": err.Error()})
	}

	return ctx.JSON(fiber.Map{
		"access_token":  accessToken,
		"refresh_token": refreshToken,
	})
}

type AdminRefreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

func (c *AdminAuthController) Refresh(ctx fiber.Ctx) error {
	var req AdminRefreshRequest
	if err := ctx.Bind().Body(&req); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	accessToken, refreshToken, err := c.adminAuthService.RefreshAdminTokens(ctx.Context(), req.RefreshToken)
	if err != nil {
		return ctx.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": err.Error()})
	}

	return ctx.JSON(fiber.Map{
		"access_token":  accessToken,
		"refresh_token": refreshToken,
	})
}

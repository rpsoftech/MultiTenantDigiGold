package admin

import (
	"github.com/gofiber/fiber/v3"
	"github.com/rpsoftech/DigiGold/MainServerGo/interfaces"
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
	authGroup.Post("/logout", c.Logout)
}

// Every handler returns its error to GlobalErrorHandler rather than writing the response
// itself: client errors keep their status and stable Name, and anything else becomes a
// generic 500 (reported to monitoring) instead of a 401 carrying internal error text.
var errInvalidAuthBody = &interfaces.RequestError{
	StatusCode: fiber.StatusBadRequest,
	Code:       interfaces.ERROR_INVALID_INPUT,
	Name:       "INVALID_INPUT",
	Message:    "Invalid request body",
}

type AdminLoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

func (c *AdminAuthController) Login(ctx fiber.Ctx) error {
	var req AdminLoginRequest
	if err := ctx.Bind().Body(&req); err != nil {
		return errInvalidAuthBody
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
		return errInvalidAuthBody
	}

	_, uri, err := c.adminAuthService.SetupTOTP(ctx.Context(), req.TempToken)
	if err != nil {
		return err
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
		return errInvalidAuthBody
	}

	clientIP := ctx.IP()
	accessToken, refreshToken, err := c.adminAuthService.VerifyTOTP(ctx.Context(), req.TempToken, req.Code, clientIP)
	if err != nil {
		return err
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
		return errInvalidAuthBody
	}

	accessToken, refreshToken, err := c.adminAuthService.RefreshAdminTokens(ctx.Context(), req.RefreshToken)
	if err != nil {
		return err
	}

	return ctx.JSON(fiber.Map{
		"access_token":  accessToken,
		"refresh_token": refreshToken,
	})
}

type AdminLogoutRequest struct {
	RefreshToken string `json:"refresh_token"`
}

// Logout revokes the session's refresh token server-side. Clearing tokens in the browser
// alone left a copied refresh token usable until it expired (7 days).
func (c *AdminAuthController) Logout(ctx fiber.Ctx) error {
	var req AdminLogoutRequest
	if err := ctx.Bind().Body(&req); err != nil {
		return errInvalidAuthBody
	}
	if err := c.adminAuthService.RevokeAdminRefreshToken(ctx.Context(), req.RefreshToken); err != nil {
		return err
	}
	return ctx.JSON(fiber.Map{"success": true})
}

package auth_controllers

import (
	"errors"
	"fmt"
	"strings"

	"github.com/gofiber/fiber/v3"
	"github.com/rpsoftech/DigiGold/MainServerGo/interfaces"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/middleware"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/service"
	utility_functions "github.com/rpsoftech/DigiGold/MainServerGo/utility/functions"
)

type (
	AuthController struct {
		OTPService     *service.OTPService
		UserService    *service.UserService
		JWTService     *service.JWTService
		SessionService *service.UserSessionService
	}
	// Phone numbers are 10 digits and OTPs 6 digits ("number" is digits only). Validated
	// explicitly (ValidateReqInput): binding alone doesn't enforce the tags, so any string
	// used to get an OTP sent, and varying it got round the per-phone cooldown.
	RequestOTPPayload struct {
		Phone string `json:"phone" validate:"required,len=10,number"`
	}

	RequestOTPResponse struct {
		Success      bool   `json:"success"`
		Message      string `json:"message"`
		IsRegistered bool   `json:"is_registered"`
	}
	VerifyOTPPayload struct {
		Phone string `json:"phone" validate:"required,len=10,number"`
		OTP   string `json:"otp" validate:"required,len=6,number"`
	}

	// RefreshPayload carries the refresh token for POST /auth/refresh and /auth/logout.
	RefreshPayload struct {
		RefreshToken string `json:"refresh_token" validate:"required"`
	}

	VerifyOTPResponse struct {
		*RequestOTPResponse
		AccessToken       string `json:"access_token,omitempty"`
		RefreshToken      string `json:"refresh_token,omitempty"`
		RegistrationToken string `json:"registration_token,omitempty"`
	}
	RegisterPayload struct {
		RegistrationToken string `json:"registration_token" validate:"required"`
		FullName          string `json:"full_name" validate:"required,max=255"`
		Location          string `json:"location" validate:"required,min=2,max=100"` // city, stored as users.user_city
		EmailID           string `json:"email_id"`
	}
)

func NewAuthController() *AuthController {
	return &AuthController{
		OTPService:     service.GetOTPService(),
		UserService:    service.GetUserService(),
		JWTService:     service.GetJWTService(),
		SessionService: service.GetUserSessionService(),
	}
}

func (ac *AuthController) RegisterRoutes(api fiber.Router) {
	api.Post("/register", ac.Register)
	api.Post("/refresh", ac.Refresh)
	api.Post("/logout", ac.Logout)
	otp := api.Group("/otp")
	otp.Post("/request", ac.RequestOTP)
	otp.Post("/verify", ac.VerifyOTP)
}

// invalidJSON is returned for a body that isn't valid JSON. The decoder's own message is not
// echoed back to the client.
var invalidJSON = &interfaces.RequestError{
	StatusCode: fiber.StatusBadRequest,
	Code:       interfaces.ERROR_INVALID_INPUT,
	Message:    "Invalid JSON payload",
	Name:       "INVALID_INPUT",
}

// RequestOTP handles POST /api/v1/auth/otp/request
func (ac *AuthController) RequestOTP(c fiber.Ctx) error {
	tenantID := middleware.GetTenantIntID(c)
	tenantUUID := middleware.GetTenantUUID(c)

	var payload RequestOTPPayload
	if err := c.Bind().JSON(&payload); err != nil {
		return invalidJSON
	}
	payload.Phone = strings.TrimSpace(payload.Phone)
	if reqErr := utility_functions.ValidateReqInput(&payload); reqErr != nil {
		return reqErr
	}

	isRegistered, err := ac.OTPService.SendOTP(c.Context(), tenantID, tenantUUID, payload.Phone)
	if err != nil {
		return interfaces.ParseDBError(err)
	}

	return c.JSON(RequestOTPResponse{
		Success:      true,
		Message:      "OTP Dispatched Successfully",
		IsRegistered: isRegistered,
	})
}

// VerifyOTP handles POST /api/v1/auth/otp/verify
func (ac *AuthController) VerifyOTP(c fiber.Ctx) error {
	tenantID := middleware.GetTenantIntID(c)
	tenantUUID := middleware.GetTenantUUID(c)

	var payload VerifyOTPPayload
	if err := c.Bind().JSON(&payload); err != nil {
		return invalidJSON
	}
	payload.Phone = strings.TrimSpace(payload.Phone)
	payload.OTP = strings.TrimSpace(payload.OTP)
	if reqErr := utility_functions.ValidateReqInput(&payload); reqErr != nil {
		return reqErr
	}

	err := ac.OTPService.VerifyOTP(c.Context(), tenantUUID, payload.Phone, payload.OTP)
	if err != nil {
		return err
	}

	user, err := ac.UserService.UserRepo.GetFullUserByPhone(c.Context(), tenantID, payload.Phone)
	if err != nil {
		if errors.Is(err, interfaces.ErrUserNotFound) {

			regToken, err := ac.JWTService.GenerateRegistrationToken(payload.Phone, tenantUUID)
			if err != nil {
				return fmt.Errorf("failed to generate registration token: %w", err)
			}

			return c.JSON(VerifyOTPResponse{
				RequestOTPResponse: &RequestOTPResponse{
					Message:      "OTP Verified Successfully. User not registered yet.",
					Success:      true,
					IsRegistered: false,
				},
				RegistrationToken: regToken,
			})
		}
		return interfaces.ParseDBError(err)
	}

	accessToken, refreshToken, err := ac.SessionService.IssueTokens(c.Context(), user, tenantUUID)
	if err != nil {
		return err
	}

	return c.JSON(VerifyOTPResponse{
		RequestOTPResponse: &RequestOTPResponse{
			Success:      true,
			IsRegistered: true,
			Message:      "OTP Verified Successfully.",
		},
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
	})
}

// Register handles POST /api/v1/auth/register
func (ac *AuthController) Register(c fiber.Ctx) error {
	tenantID := middleware.GetTenantIntID(c)
	tenantUUID := middleware.GetTenantUUID(c)

	var payload RegisterPayload
	if err := c.Bind().JSON(&payload); err != nil {
		return invalidJSON
	}

	// The tags above are only enforced when validated explicitly.
	payload.FullName = strings.TrimSpace(payload.FullName)
	payload.Location = strings.TrimSpace(payload.Location)
	payload.EmailID = strings.TrimSpace(payload.EmailID)
	if reqErr := utility_functions.ValidateReqInput(&payload); reqErr != nil {
		return reqErr
	}

	// 4. USE THE INJECTED SINGLETON
	phone, tokenTenantUUID, err := ac.JWTService.ValidateRegistrationToken(payload.RegistrationToken)
	if err != nil {
		statusCode := fiber.StatusUnauthorized
		if errors.Is(err, interfaces.ErrTokenExpired) {
			return c.Status(statusCode).JSON(fiber.Map{
				"success": false,
				"error":   "Registration token has expired",
				"code":    interfaces.ERROR_TOKEN_EXPIRED,
			})
		}
		return c.Status(statusCode).JSON(fiber.Map{
			"success": false,
			"error":   "Invalid registration token",
			"code":    interfaces.ERROR_INVALID_TOKEN,
		})
	}

	if tokenTenantUUID != tenantUUID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"error":   "Tenant mismatch. Access denied.",
		})
	}

	// 3. CRITICAL FIX: Use c.Context()
	user, err := ac.UserService.RegisterUser(c.Context(), tenantID, phone, payload.FullName, payload.EmailID, payload.Location)
	if err != nil {
		return interfaces.ParseDBError(err)
	}

	accessToken, refreshToken, err := ac.SessionService.IssueTokens(c.Context(), user, tenantUUID)
	if err != nil {
		return err
	}

	return c.JSON(fiber.Map{
		"success":       true,
		"access_token":  accessToken,
		"refresh_token": refreshToken,
	})
}

// Refresh handles POST /api/v1/auth/refresh: it exchanges a customer refresh token for a new
// token pair. Refresh tokens are single use; the one sent stops working.
func (ac *AuthController) Refresh(c fiber.Ctx) error {
	var payload RefreshPayload
	if err := c.Bind().JSON(&payload); err != nil {
		return invalidJSON
	}
	if reqErr := utility_functions.ValidateReqInput(&payload); reqErr != nil {
		return reqErr
	}

	accessToken, refreshToken, err := ac.SessionService.Refresh(c.Context(), payload.RefreshToken,
		middleware.GetTenantIntID(c), middleware.GetTenantUUID(c))
	if err != nil {
		return err
	}

	return c.JSON(fiber.Map{
		"success":       true,
		"access_token":  accessToken,
		"refresh_token": refreshToken,
	})
}

// Logout handles POST /api/v1/auth/logout: it revokes the customer's refresh token, so a copy
// of it can't be used after the customer signs out.
func (ac *AuthController) Logout(c fiber.Ctx) error {
	var payload RefreshPayload
	if err := c.Bind().JSON(&payload); err != nil {
		return invalidJSON
	}
	if err := ac.SessionService.Revoke(c.Context(), payload.RefreshToken); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"success": true})
}

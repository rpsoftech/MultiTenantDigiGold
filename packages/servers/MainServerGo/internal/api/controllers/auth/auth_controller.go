package auth_controllers

import (
	"errors"

	"github.com/gofiber/fiber/v3"
	"github.com/rpsoftech/DigiGold/MainServerGo/interfaces"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/middleware"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/service"
)

type (
	AuthController struct {
		OTPService  *service.OTPService
		UserService *service.UserService
		JWTService  *service.JWTService // 1. ADD THE JWT SERVICE SINGLETON
	}
	RequestOTPPayload struct {
		Phone string `json:"phone" validate:"required,len=10"`
	}

	RequestOTPResponse struct {
		Success      bool   `json:"success"`
		Message      string `json:"message"`
		IsRegistered bool   `json:"is_registered"`
	}
	VerifyOTPPayload struct {
		Phone string `json:"phone" validate:"required,len=10"`
		OTP   string `json:"otp" validate:"required,len=6"`
	}

	VerifyOTPResponse struct {
		*RequestOTPResponse
		AccessToken       string `json:"access_token,omitempty"`
		RefreshToken      string `json:"refresh_token,omitempty"`
		RegistrationToken string `json:"registration_token,omitempty"`
	}
	RegisterPayload struct {
		RegistrationToken string  `json:"registration_token" validate:"required"`
		FullName          string  `json:"full_name" validate:"required"`
		EmailID           *string `json:"email_id"`
	}
)

func NewAuthController() *AuthController {
	return &AuthController{
		OTPService:  service.GetOTPService(),
		UserService: service.GetUserService(),
		JWTService:  service.GetJWTService(), // 2. INJECT IT HERE
	}
}

func (ac *AuthController) RegisterRoutes(api fiber.Router) {
	api.Post("/register", ac.Register)
	otp := api.Group("/otp")
	otp.Post("/request", ac.RequestOTP)
	otp.Post("/verify", ac.VerifyOTP)
}

// RequestOTP handles POST /api/v1/auth/otp/request
func (ac *AuthController) RequestOTP(c fiber.Ctx) error {
	tenantID := middleware.GetTenantIntID(c)
	tenantUUID := middleware.GetTenantUUID(c)

	var payload RequestOTPPayload
	if err := c.Bind().JSON(&payload); err != nil {
		return &interfaces.RequestError{
			StatusCode: fiber.StatusBadRequest,
			Code:       interfaces.ERROR_INVALID_INPUT,
			Message:    "Invalid JSON payload",
			Name:       "INVALID_INPUT",
			Extra:      err.Error(),
		}
	}

	// 3. CRITICAL FIX: Use c.Context() instead of c.Context()
	isRegistered, err := ac.OTPService.SendOTP(c.Context(), tenantID, tenantUUID, payload.Phone)
	if err != nil {
		return &interfaces.RequestError{
			StatusCode: fiber.StatusUnauthorized,
			Code:       interfaces.ERROR_ENTITY_NOT_FOUND,
			Message:    "Failed to send OTP",
			Name:       err.Error(),
			Extra:      err.Error(),
		}
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
		return &interfaces.RequestError{
			StatusCode: fiber.StatusBadRequest,
			Code:       interfaces.ERROR_INVALID_INPUT,
			Message:    "Invalid JSON payload",
			Name:       "INVALID_INPUT",
			Extra:      err.Error(),
		}
	}

	// 3. CRITICAL FIX: Use c.Context()
	err := ac.OTPService.VerifyOTP(c.Context(), tenantUUID, payload.Phone, payload.OTP)
	if err != nil {
		return interfaces.ParseDBError(err)
	}

	user, err := ac.UserService.UserRepo.GetFullUserByPhone(c.Context(), tenantID, payload.Phone)
	if err != nil {
		if errors.Is(err, interfaces.ErrUserNotFound) {

			// 4. USE THE INJECTED SINGLETON
			regToken, err := ac.JWTService.GenerateRegistrationToken(payload.Phone, tenantUUID)
			if err != nil {
				return &interfaces.RequestError{
					StatusCode: fiber.StatusInternalServerError,
					Code:       interfaces.ERROR_INTERNAL_SERVER,
					Message:    "Failed to generate registration token",
					Name:       "INTERNAL_SERVER_ERROR",
					Extra:      err.Error(),
				}
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

	// 4. USE THE INJECTED SINGLETON
	accessToken, refreshToken, err := ac.JWTService.GenerateTokens(user.UUID, tenantUUID, user.PhoneNumber)
	if err != nil {
		return &interfaces.RequestError{
			StatusCode: fiber.StatusInternalServerError,
			Code:       interfaces.ERROR_INTERNAL_SERVER,
			Message:    "Failed to generate authentication tokens",
			Name:       "INTERNAL_SERVER_ERROR",
			Extra:      err.Error(),
		}
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
		return &interfaces.RequestError{
			StatusCode: fiber.StatusBadRequest,
			Code:       interfaces.ERROR_INVALID_INPUT,
			Message:    "Invalid JSON payload",
			Name:       "INVALID_INPUT",
			Extra:      err.Error(),
		}
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
	user, err := ac.UserService.RegisterUser(c.Context(), tenantID, phone, payload.FullName, payload.EmailID)
	if err != nil {
		return interfaces.ParseDBError(err)
	}

	// 4. USE THE INJECTED SINGLETON
	accessToken, refreshToken, err := ac.JWTService.GenerateTokens(user.UUID, tenantUUID, user.PhoneNumber)
	if err != nil {
		return &interfaces.RequestError{
			StatusCode: fiber.StatusInternalServerError,
			Code:       interfaces.ERROR_INTERNAL_SERVER,
			Message:    "Failed to generate authentication tokens",
			Name:       "INTERNAL_SERVER_ERROR",
			Extra:      err.Error(),
		}
	}

	return c.JSON(fiber.Map{
		"success":       true,
		"access_token":  accessToken,
		"refresh_token": refreshToken,
	})
}

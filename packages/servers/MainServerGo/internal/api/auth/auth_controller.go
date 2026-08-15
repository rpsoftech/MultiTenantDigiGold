package auth_controllers

import (
	"github.com/gofiber/fiber/v3"
	"github.com/rpsoftech/DigiGold/MainServerGo/interfaces"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/middleware"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/service"
)

type AuthController struct {
	OTPService *service.OTPService
}

func NewAuthController() *AuthController {
	return &AuthController{
		OTPService: service.GetOTPService(),
	}
}

type RequestOTPPayload struct {
	Phone string `json:"phone" validate:"required,len=10"`
}

// RequestOTP handles POST /api/v1/auth/otp/request
func (ac *AuthController) RequestOTP(c fiber.Ctx) error {
	// 1. Grab the SECURE Tenant UUID injected by the Middleware
	tenantID := middleware.GetTenantIntID(c)
	tenantUUID := middleware.GetTenantUUID(c)
	// 2. Parse the JSON Body using Fiber v3's built-in binder
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

	// 3. Delegate to the core Service Layer
	// CRITICAL: We pass c.UserContext() so PostgreSQL honors timeouts and cancellations
	err := ac.OTPService.SendLoginOTP(c.Context(), tenantID, tenantUUID, payload.Phone)
	if err != nil {
		return &interfaces.RequestError{
			StatusCode: fiber.StatusUnauthorized,
			Code:       interfaces.ERROR_ENTITY_NOT_FOUND,
			Message:    "Failed to send OTP",
			Name:       err.Error(),
			Extra:      err.Error(),
		}
	}

	// 4. Respond instantly
	return c.JSON(fiber.Map{
		"success": true,
		"message": "OTP Dispatched Successfully",
	})
}

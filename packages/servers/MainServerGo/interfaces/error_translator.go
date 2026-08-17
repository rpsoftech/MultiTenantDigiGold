package interfaces

import (
	"errors"
)

// ParseDBError translates your clean domain errors into your strict JSON format
func ParseDBError(err error) *RequestError {
	if err == nil {
		return nil
	}

	// 1. Check for specific fixed structures using errors.Is()
	switch {
	case errors.Is(err, ErrUserNotFound):
		return &RequestError{
			StatusCode:    404,
			Code:          ERROR_USER_NOT_FOUND,
			Message:       "The requested user could not be found.",
			Name:          "ERROR_USER_NOT_FOUND",
			LogTheDetails: false, // Don't wake up developers for a 404
		}

	case errors.Is(err, ErrTenantNotFound):
		return &RequestError{
			StatusCode:    401, // 401 Unauthorized because the tenant ID is invalid
			Code:          ERROR_ENTITY_NOT_FOUND,
			Message:       "Invalid Tenant ID.",
			Name:          "ERROR_INVALID_TENANT",
			LogTheDetails: true, // Log this, someone might be trying to bypass isolation
		}

	case errors.Is(err, ErrAdminNotFound):
		return &RequestError{
			StatusCode:    401,
			Code:          ERROR_ENTITY_NOT_FOUND,
			Message:       "Admin/Staff Member Not Found or Inactive.",
			Name:          "ErrAdminNotFound",
			LogTheDetails: false,
		}

	case errors.Is(err, ErrInvalidToken):
		return &RequestError{
			StatusCode:    401,
			Code:          ERROR_INVALID_TOKEN,
			Message:       "User Token Not Found or Invalid.",
			Name:          "ERROR_INVALID_TOKEN",
			LogTheDetails: false,
		}
	case errors.Is(err, ErrRecentOTPReqExist):
		return &RequestError{
			StatusCode:    429, // 429 Too Many Requests (Industry standard for rate limiting)
			Code:          ERROR_RECENT_OTP_REQ_EXIST,
			Message:       "Please wait 30 seconds before requesting a new OTP.",
			Name:          "ERROR_RECENT_OTP_REQ_EXIST",
			LogTheDetails: false, // Normal user behavior, do not spam your server logs
		}

	case errors.Is(err, ErrOTPReqNotFound):
		return &RequestError{
			StatusCode:    404, // 404 Not Found
			Code:          ERROR_OTP_REQ_NOT_FOUND,
			Message:       "Your OTP has expired or was not found. Please request a new one.",
			Name:          "ERROR_OTP_REQ_NOT_FOUND",
			LogTheDetails: false,
		}

	case errors.Is(err, ErrOTPInvalid):
		return &RequestError{
			StatusCode:    401, // 401 Unauthorized
			Code:          ERROR_OTP_INVALID,
			Message:       "The OTP you entered is incorrect.",
			Name:          "ERROR_OTP_INVALID",
			LogTheDetails: false, // Users make typos all the time, keep logs clean
		}

	case errors.Is(err, ErrMaxResendAttempts):
		return &RequestError{
			StatusCode:    429,
			Code:          ERROR_TOO_MANY_ATTEMPTS,
			Message:       "Maximum OTP resend attempts reached. Please try again later.",
			Name:          "ERROR_MAX_RESEND_ATTEMPTS",
			LogTheDetails: false,
		}

	case errors.Is(err, ErrMaxVerifyAttempts):
		return &RequestError{
			StatusCode:    429,
			Code:          ERROR_TOO_MANY_ATTEMPTS,
			Message:       "Too many incorrect guesses. OTP has been invalidated.",
			Name:          "ERROR_MAX_VERIFY_ATTEMPTS",
			LogTheDetails: false,
		}
	}

	// 2. Fallback for actual database crashes (Connection dropped, syntax error, etc.)
	return &RequestError{
		StatusCode:    500,
		Code:          ERROR_INTERNAL_SERVER,
		Message:       "An unexpected system error occurred.",
		Name:          "ERROR_INTERNAL_SERVER",
		Extra:         err.Error(), // Safe to log internally, maybe hide from frontend
		LogTheDetails: true,
	}
}

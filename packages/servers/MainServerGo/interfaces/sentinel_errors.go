package interfaces

import "errors"

var (
	ErrTenantNotFound       = errors.New("invalid or missing tenant")
	ErrTenantConfigNotFound = errors.New("Tenant Config not found")
	ErrUserNotFound         = errors.New("user not found")
	ErrInvalidToken         = errors.New("invalid token signature")
	ErrOTPExpired           = errors.New("otp expired")
	ErrAdminNotFound        = errors.New("admin/staff member not found or inactive")
)

// NEW: OTP Service Errors
var (
	ErrRecentOTPReqExist = errors.New("an OTP request was recently made, please wait")
	ErrOTPReqNotFound    = errors.New("OTP request not found or expired")
	ErrOTPInvalid        = errors.New("invalid OTP provided")
	// NEW ERRORS
	ErrMaxResendAttempts = errors.New("maximum OTP resend attempts reached, try again later")
	ErrMaxVerifyAttempts = errors.New("too many incorrect guesses, OTP invalidated")
)

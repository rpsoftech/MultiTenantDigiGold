package interfaces

import "errors"

var (
	ErrTenantNotFound       = errors.New("invalid or missing tenant")
	ErrTenantConfigNotFound = errors.New("Tenant Config not found")
	ErrUserNotFound         = errors.New("USER_NOT_FOUND")
	ErrInvalidToken         = errors.New("invalid token signature")
	ErrTokenExpired         = errors.New("token has expired")
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

// Ledger / Trade Errors
var (
	ErrInsufficientBalance   = errors.New("insufficient gold balance")
	ErrLedgerEntryNotFound   = errors.New("ledger entry not found")
	ErrLedgerAlreadyReversed = errors.New("ledger entry is already reversed")
	ErrLedgerNotReversible   = errors.New("ledger entry cannot be reversed")
	ErrSlippageExceeded      = errors.New("live rate moved beyond allowable tolerance")
	ErrInvalidTradePayload   = errors.New("must specify a positive weight_grams or total_amount_inr")
)

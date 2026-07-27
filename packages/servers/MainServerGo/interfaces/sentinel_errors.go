package interfaces

import "errors"

var (
	ErrTenantNotFound = errors.New("invalid or missing tenant")
	ErrUserNotFound   = errors.New("user not found")
	ErrInvalidToken   = errors.New("invalid token signature")
	ErrOTPExpired     = errors.New("otp expired")
	ErrAdminNotFound  = errors.New("admin/staff member not found or inactive")
)

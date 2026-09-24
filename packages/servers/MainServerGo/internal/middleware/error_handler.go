package middleware

import (
	"errors"
	"fmt"

	"github.com/gofiber/fiber/v3"
	"github.com/rpsoftech/DigiGold/MainServerGo/interfaces"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/monitoring"
	// "github.com/getsentry/sentry-go" // Uncomment when Sentry is installed
)

// GlobalErrorHandler intercepts every error returned by any Fiber controller
func GlobalErrorHandler(c fiber.Ctx, err error) error {
	// 1. THE MISSING LINK: Run every raw error through your Central Translator first!
	// If it's a known Sentinel Error (like ErrRecentOTPReqExist), it becomes a RequestError.
	// If it's already a RequestError, ParseDBError should safely pass it through.
	translatedErr := interfaces.ParseDBError(err)

	// 2. Default to 500 Internal Server Error
	code := fiber.StatusInternalServerError
	message := "Internal Server Error"
	errorCode := interfaces.ERROR_INTERNAL_SERVER
	name := "Error"
	var extra any

	// 3. Extract the structured data from our Custom Error
	if reqErr, ok := errors.AsType[*interfaces.RequestError](translatedErr); ok {
		code = reqErr.StatusCode
		message = reqErr.Message
		errorCode = reqErr.Code
		name = reqErr.Name
		extra = reqErr.Extra
	} else {
		// Fallback: Check if it's a standard Fiber error (e.g., 404 Route Not Found)
		if fiberErr, ok := errors.AsType[*fiber.Error](err); ok {
			code = fiberErr.Code
			message = fiberErr.Message
		}
	}

	// 4. Sentry Integration
	// We only want to spam Sentry for actual server crashes (500+),
	// not because a user typed the wrong OTP (400/401).
	if code >= 500 {
		// Report the ORIGINAL err (with details) to monitoring; the client gets a generic message.
		monitoring.Critical(c.Context(), monitoring.KindHTTP5xx, fmt.Errorf("%s %s: %w", c.Method(), c.Path(), err))

		// Never send internal details (DB errors, stack info) to clients.
		message = "Internal Server Error"
		extra = nil
	}

	// 5. Compress the output into a uniform JSON response for the React frontend
	return c.Status(code).JSON(fiber.Map{
		// 	Code          int    `json:"code"`
		// Message       string `json:"message"`
		// Name          string `json:"name"`
		// Extra         any    `json:"extra,omitempty"`
		"success": false,
		"message": message,
		"code":    errorCode,
		"name":    name,
		"extra":   extra, // Optional: You might want to hide this in Production
	})
}

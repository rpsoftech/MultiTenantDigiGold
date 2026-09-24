package middleware

import (
	"errors"
	"fmt"

	"github.com/gofiber/fiber/v3"
	"github.com/rpsoftech/DigiGold/MainServerGo/interfaces"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/monitoring"
)

// GlobalErrorHandler intercepts every error returned by any Fiber controller
func GlobalErrorHandler(c fiber.Ctx, err error) error {
	// 1. Default to 500 Internal Server Error
	code := fiber.StatusInternalServerError
	message := "Internal Server Error"
	errorCode := interfaces.ERROR_INTERNAL_SERVER
	name := "Error"
	var extra any

	// 2. Fiber's own errors (404 route not found, 405, 413...) keep their status.
	// They must be checked before ParseDBError, which turns any unknown error into a 500.
	if fiberErr, ok := errors.AsType[*fiber.Error](err); ok {
		code = fiberErr.Code
		message = fiberErr.Message
	} else if reqErr, ok := errors.AsType[*interfaces.RequestError](interfaces.ParseDBError(err)); ok {
		// 3. Every other error runs through the central translator: known sentinel
		// errors become RequestErrors; anything else becomes a 500.
		code = reqErr.StatusCode
		message = reqErr.Message
		errorCode = reqErr.Code
		name = reqErr.Name
		extra = reqErr.Extra
	}

	// 4. Monitoring: only real server failures (500+) alert, not client
	// mistakes such as a wrong OTP (400/401).
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

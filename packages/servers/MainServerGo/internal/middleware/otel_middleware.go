package middleware

import (
	"errors"

	"github.com/gofiber/fiber/v3"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"

	"github.com/rpsoftech/DigiGold/MainServerGo/interfaces"
)

var tracer = otel.Tracer("fiber-server")

// OtelInterceptor starts an OpenTelemetry span for each incoming HTTP request
func OtelInterceptor(c fiber.Ctx) error {
	ctx := c.Context()

	spanCtx, span := tracer.Start(ctx, c.Path())
	defer span.End()

	// Set Span attributes
	span.SetAttributes(
		attribute.String("http.method", c.Method()),
		attribute.String("http.url", c.OriginalURL()),
		attribute.String("http.client_ip", c.IP()),
	)

	// Replace the context with the spanned context
	c.SetContext(spanCtx)

	// Execute next handler
	err := c.Next()

	// Record the response status. A returned error is rendered later by
	// GlobalErrorHandler (after this span ends), so take its status from the error.
	status := c.Response().StatusCode()
	if err != nil {
		status = fiber.StatusInternalServerError
		if reqErr, ok := errors.AsType[*interfaces.RequestError](interfaces.ParseDBError(err)); ok {
			status = reqErr.StatusCode
		} else if fiberErr, ok := errors.AsType[*fiber.Error](err); ok {
			status = fiberErr.Code
		}
		span.SetAttributes(attribute.String("error", err.Error()))
	}
	span.SetAttributes(attribute.Int("http.status_code", status))
	if status >= fiber.StatusInternalServerError {
		if err != nil {
			span.RecordError(err)
		}
		span.SetStatus(codes.Error, "server error")
	}

	return err
}

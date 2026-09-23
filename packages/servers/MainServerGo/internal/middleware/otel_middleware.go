package middleware

import (
	"github.com/gofiber/fiber/v3"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
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

	// Record Response Status
	span.SetAttributes(attribute.Int("http.status_code", c.Response().StatusCode()))

	if err != nil {
		span.SetAttributes(attribute.String("error", err.Error()))
	}

	return err
}

package otel

import (
	"context"
	"log"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.17.0"
)

// InitTracer initializes an OTLP exporter, and configures the corresponding trace and
// metric providers.
func InitTracer(ctx context.Context, serviceName string) (*sdktrace.TracerProvider, error) {
	// 1. Setup Exporter
	exporter, err := otlptracegrpc.New(ctx,
		otlptracegrpc.WithInsecure(),
		// otlptracegrpc.WithEndpoint("localhost:4317"), // Default is localhost:4317
	)
	if err != nil {
		return nil, err
	}

	// 2. Define Resource (Service Identity)
	res, err := resource.New(ctx,
		resource.WithAttributes(
			semconv.ServiceName(serviceName),
		),
	)
	if err != nil {
		return nil, err
	}

	// 3. Setup Tracer Provider
	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(res),
	)

	// Set global Tracer Provider
	otel.SetTracerProvider(tp)

	log.Println("✅ OpenTelemetry Tracer initialized successfully (OTLP gRPC).")
	return tp, nil
}

// InitMeter configures an OTLP gRPC metric exporter that pushes every 30 s.
// The endpoint comes from OTEL_EXPORTER_OTLP_ENDPOINT (default localhost:4317).
func InitMeter(ctx context.Context, serviceName string) (*sdkmetric.MeterProvider, error) {
	exporter, err := otlpmetricgrpc.New(ctx, otlpmetricgrpc.WithInsecure())
	if err != nil {
		return nil, err
	}
	res, err := resource.New(ctx, resource.WithAttributes(semconv.ServiceName(serviceName)))
	if err != nil {
		return nil, err
	}
	mp := sdkmetric.NewMeterProvider(
		sdkmetric.WithReader(sdkmetric.NewPeriodicReader(exporter, sdkmetric.WithInterval(30*time.Second))),
		sdkmetric.WithResource(res),
	)
	otel.SetMeterProvider(mp)
	log.Println("✅ OpenTelemetry Meter initialized successfully (OTLP gRPC).")
	return mp, nil
}

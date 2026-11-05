package otel

import (
	"context"
	"errors"
	"log"
	"os"
	"strings"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.17.0"
)

// endpointEnv is the standard OpenTelemetry variable for the OTLP collector,
// e.g. "http://otel-collector:4317" (plain gRPC) or "https://otlp.example.com:4317" (TLS).
const endpointEnv = "OTEL_EXPORTER_OTLP_ENDPOINT"

// Init sends traces and metrics to the OTLP collector named by
// OTEL_EXPORTER_OTLP_ENDPOINT. When the variable is not set, nothing is
// exported: the OpenTelemetry API stays a no-op and monitoring.Critical still
// logs every critical error. Call the returned function on shutdown to flush.
//
// Export is opt-in because a missing collector made the exporters log
// "connection refused" every 30 seconds.
func Init(ctx context.Context, serviceName string) (shutdown func(context.Context)) {
	endpoint := os.Getenv(endpointEnv)
	if endpoint == "" || os.Getenv("OTEL_SDK_DISABLED") == "true" {
		log.Printf("ℹ️  OpenTelemetry export disabled (set %s to send traces and metrics to a collector)", endpointEnv)
		return func(context.Context) {}
	}
	// A plain collector (http:// or no scheme) needs an insecure gRPC connection;
	// an https:// endpoint uses TLS.
	insecure := !strings.HasPrefix(endpoint, "https://")

	res, err := resource.New(ctx, resource.WithAttributes(semconv.ServiceName(serviceName)))
	if err != nil {
		log.Printf("⚠️ OpenTelemetry disabled: %v", err)
		return func(context.Context) {}
	}

	var shutdowns []func(context.Context) error

	traceOpts := []otlptracegrpc.Option{}
	if insecure {
		traceOpts = append(traceOpts, otlptracegrpc.WithInsecure())
	}
	if traceExporter, err := otlptracegrpc.New(ctx, traceOpts...); err != nil {
		log.Printf("⚠️ OpenTelemetry tracing disabled: %v", err)
	} else {
		tp := sdktrace.NewTracerProvider(sdktrace.WithBatcher(traceExporter), sdktrace.WithResource(res))
		otel.SetTracerProvider(tp)
		shutdowns = append(shutdowns, tp.Shutdown)
	}

	metricOpts := []otlpmetricgrpc.Option{}
	if insecure {
		metricOpts = append(metricOpts, otlpmetricgrpc.WithInsecure())
	}
	if metricExporter, err := otlpmetricgrpc.New(ctx, metricOpts...); err != nil {
		log.Printf("⚠️ OpenTelemetry metrics disabled: %v", err)
	} else {
		mp := sdkmetric.NewMeterProvider(
			sdkmetric.WithReader(sdkmetric.NewPeriodicReader(metricExporter, sdkmetric.WithInterval(30*time.Second))),
			sdkmetric.WithResource(res),
		)
		otel.SetMeterProvider(mp)
		shutdowns = append(shutdowns, mp.Shutdown)
	}

	log.Printf("✅ OpenTelemetry exporting traces and metrics to %s", endpoint)
	return func(ctx context.Context) {
		var errs []error
		for _, fn := range shutdowns {
			errs = append(errs, fn(ctx))
		}
		if err := errors.Join(errs...); err != nil {
			log.Printf("OpenTelemetry shutdown: %v", err)
		}
	}
}

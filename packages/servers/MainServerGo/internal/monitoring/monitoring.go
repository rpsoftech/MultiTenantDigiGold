// Package monitoring reports critical errors and business signals to Grafana
// through OpenTelemetry. Every call also writes a log line, so nothing is lost
// when no collector is running.
//
// Metrics (OTLP, exported by the meter set up in cmd/api and cmd/worker):
//
//	digigold.critical_errors  counter  {kind}    alert on any increase
//	digigold.payment_refunds  counter  {reason}  captured payments refunded instead of settled
package monitoring

import (
	"context"
	"log"
	"strings"
	"sync"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/metric"
	"go.opentelemetry.io/otel/trace"
)

// Kinds of critical error. Keep the set small: each value is a metric label.
const (
	KindHTTP5xx         = "http_5xx"
	KindEventPublish    = "event_publish"
	KindEventConsumer   = "event_consumer"
	KindOutboxRepublish = "outbox_republish"
	KindPartitionMaint  = "partition_maintenance"
	KindWhatsAppSend    = "whatsapp_send"
	KindWebhookFailed   = "webhook_processing"
	KindRefundFailed    = "refund_failed"
	KindRefundNotLogged = "refund_not_logged"
)

var (
	initOnce       sync.Once
	criticalErrors metric.Int64Counter
	refunds        metric.Int64Counter
)

// instruments are created lazily from the global meter provider, so they bind
// to the OTLP provider once main has installed it.
func instruments() {
	initOnce.Do(func() {
		meter := otel.Meter("digigold")
		criticalErrors, _ = meter.Int64Counter("digigold.critical_errors",
			metric.WithDescription("Errors that need a human: failed refunds, lost events, 5xx responses"))
		refunds, _ = meter.Int64Counter("digigold.payment_refunds",
			metric.WithDescription("Captured payments refunded because no gold could be credited"))
	})
}

// Critical logs err, counts it under kind, and marks the current span as failed.
func Critical(ctx context.Context, kind string, err error) {
	log.Printf("CRITICAL [%s]: %v", kind, err)
	instruments()
	if criticalErrors != nil {
		criticalErrors.Add(ctx, 1, metric.WithAttributes(attribute.String("kind", kind)))
	}
	if span := trace.SpanFromContext(ctx); span.IsRecording() {
		span.RecordError(err)
		span.SetStatus(codes.Error, kind)
	}
}

// PaymentRefunded counts a refund. reason is the text before the first ':'
// (e.g. "trade rejected: ..." counts as "trade rejected").
func PaymentRefunded(ctx context.Context, reason string) {
	instruments()
	if refunds != nil {
		label, _, _ := strings.Cut(reason, ":")
		refunds.Add(ctx, 1, metric.WithAttributes(attribute.String("reason", strings.TrimSpace(label))))
	}
}

//go:build integration

package integration

import (
	"context"
	"net/http"
	"net/url"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/rpsoftech/DigiGold/MainServerGo/internal/database"
)

func platformAdmin(t *testing.T) string {
	return adminToken(t, database.SeedPlatformAdminUsername, database.SeedPlatformTenantUUID)
}

// auditEvents reads the audit log as the platform super admin.
func auditEvents(t *testing.T, query url.Values) response {
	t.Helper()
	return call(t, "GET", "/admin/events?"+query.Encode(), platformAdmin(t), database.SeedPlatformTenantUUID, nil)
}

func eventRows(r response) []map[string]any {
	items, _ := r.Body["data"].([]any)
	rows := make([]map[string]any, 0, len(items))
	for _, item := range items {
		if row, ok := item.(map[string]any); ok {
			rows = append(rows, row)
		}
	}
	return rows
}

// insertEvent writes an event straight into the store, as the services do.
func insertEvent(t *testing.T, tenantID, name, payload string) string {
	t.Helper()
	id := uuid.NewString()
	if _, err := db.ExecContext(context.Background(), `
		INSERT INTO system_events (event_id, key_id, tenant_id, event_name, payload, occurred_at)
		VALUES ($1, $1, $2, $3, $4::jsonb, NOW())`, id, tenantID, name, payload); err != nil {
		t.Fatalf("insert event: %v", err)
	}
	return id
}

func findEvent(rows []map[string]any, id string) map[string]any {
	for _, row := range rows {
		if str(row["id"]) == id {
			return row
		}
	}
	return nil
}

// The audit log must never hand out a customer's live login OTP or a store's gateway secrets.
func TestAuditLog_RedactsSecretsInPayloads(t *testing.T) {
	otpID := insertEvent(t, database.SeedDemoTenantUUID, "OTPReqEvent",
		`{"otpCode": "482915", "phone": "9876543210", "reqId": "r-1"}`)
	configID := insertEvent(t, database.SeedDemoTenantUUID, "TenantConfigUpdated",
		`{"payment_config": {"key_id": "rzp_live_x", "key_secret": "s3cret", "webhook_secret": "wh"}}`)

	r := auditEvents(t, url.Values{"limit": {"100"}})
	expectStatus(t, r, http.StatusOK)
	rows := eventRows(r)

	otp := findEvent(rows, otpID)
	if otp == nil {
		t.Fatalf("OTP event missing from the log")
	}
	payload, _ := otp["payload"].(map[string]any)
	if payload["otpCode"] != "[redacted]" || payload["phone"] != "9876543210" {
		t.Fatalf("OTP payload = %v, want the code redacted and the phone kept", payload)
	}

	config := findEvent(rows, configID)
	if config == nil {
		t.Fatalf("config event missing from the log")
	}
	gateway, _ := config["payload"].(map[string]any)["payment_config"].(map[string]any)
	if gateway["key_secret"] != "[redacted]" || gateway["webhook_secret"] != "[redacted]" || gateway["key_id"] != "rzp_live_x" {
		t.Fatalf("gateway config = %v, want both secrets redacted and the key id kept", gateway)
	}
}

// Trades are recorded against the numeric tenant ID; a tenant filter by UUID must still find them.
func TestAuditLog_TenantFilterFindsEventsStoredUnderTheNumericID(t *testing.T) {
	trade := counterBuy(t, database.SeedVerifiedCustomerUUID, 0.1)
	glUUID := str(trade["gl_uuid"])

	r := auditEvents(t, url.Values{
		"tenant_uuid": {database.SeedDemoTenantUUID},
		"type":        {"TRADE_GOLD_PURCHASE"},
		"limit":       {"100"},
	})
	expectStatus(t, r, http.StatusOK)
	for _, row := range eventRows(r) {
		payload, _ := row["payload"].(map[string]any)
		if str(payload["gl_uuid"]) == glUUID {
			if str(row["tenantId"]) != database.SeedDemoTenantUUID {
				t.Fatalf("tenantId = %v, want the tenant UUID %s", row["tenantId"], database.SeedDemoTenantUUID)
			}
			return
		}
	}
	t.Fatalf("the counter sale's trade event is missing when filtering by the tenant UUID: %v", r.Body)
}

func TestAuditLog_DateFilterIsIndianTime(t *testing.T) {
	// 00:30 IST on 1 Jan 2026 is still 31 Dec in UTC.
	id := uuid.NewString()
	occurred := time.Date(2025, 12, 31, 19, 0, 0, 0, time.UTC)
	if _, err := db.ExecContext(context.Background(), `
		INSERT INTO system_events (event_id, key_id, tenant_id, event_name, payload, occurred_at)
		VALUES ($1, $1, $2, 'AUDIT_DATE_PROBE', '{}'::jsonb, $3)`, id, database.SeedDemoTenantUUID, occurred); err != nil {
		t.Fatalf("insert event: %v", err)
	}

	onDay := auditEvents(t, url.Values{"type": {"AUDIT_DATE_PROBE"}, "from": {"2026-01-01"}, "to": {"2026-01-01T23:59:59"}})
	expectStatus(t, onDay, http.StatusOK)
	if findEvent(eventRows(onDay), id) == nil {
		t.Fatalf("an event at 00:30 IST on 1 Jan is missing from 1 Jan: %v", onDay.Body)
	}
	dayBefore := auditEvents(t, url.Values{"type": {"AUDIT_DATE_PROBE"}, "from": {"2025-12-31"}, "to": {"2025-12-31T23:59:59"}})
	expectStatus(t, dayBefore, http.StatusOK)
	if findEvent(eventRows(dayBefore), id) != nil {
		t.Fatalf("an event at 00:30 IST on 1 Jan is listed under 31 Dec")
	}
}

func TestAuditLog_RejectsABadDateAndNonSuperAdmins(t *testing.T) {
	expectError(t, auditEvents(t, url.Values{"from": {"yesterday"}}), http.StatusBadRequest, "INVALID_INPUT")

	r := call(t, "GET", "/admin/events", demoManager(t), database.SeedDemoTenantUUID, nil)
	expectStatus(t, r, http.StatusForbidden)
}

func TestAuditLog_RecordsKYCDecisions(t *testing.T) {
	userUUID, token := newKYCCustomer(t)
	expectStatus(t, submitKYC(t, token, validKYC), http.StatusOK)
	expectStatus(t, decideKYC(t, "reject", userUUID), http.StatusOK)

	if !eventExists(t, "KYC_DECIDED", "user_uuid", userUUID) {
		t.Fatal("rejecting a KYC submission wrote no KYC_DECIDED event")
	}
	r := auditEvents(t, url.Values{"type": {"KYC_DECIDED"}, "limit": {"100"}})
	expectStatus(t, r, http.StatusOK)
	for _, row := range eventRows(r) {
		payload, _ := row["payload"].(map[string]any)
		if str(payload["user_uuid"]) == userUUID {
			if str(payload["status"]) != "rejected" || str(row["adminId"]) != database.SeedDemoManagerUUID {
				t.Fatalf("event = %v, want status rejected by the demo manager", row)
			}
			return
		}
	}
	t.Fatalf("KYC_DECIDED event for %s missing from the log", userUUID)
}

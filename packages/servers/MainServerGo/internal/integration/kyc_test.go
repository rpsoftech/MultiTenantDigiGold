//go:build integration

package integration

import (
	"context"
	"fmt"
	"net/http"
	"sync/atomic"
	"testing"

	"github.com/google/uuid"

	"github.com/rpsoftech/DigiGold/MainServerGo/internal/database"
)

var kycCustomerSeq atomic.Int64

// newKYCCustomer inserts a fresh demo-tenant customer in the DB's default KYC state
// (status 'pending', document '{}'), so each test owns its own KYC lifecycle instead of
// mutating the shared seed customers.
func newKYCCustomer(t *testing.T) (userUUID, token string) {
	t.Helper()
	userUUID = uuid.NewString()
	phone := fmt.Sprintf("88%08d", kycCustomerSeq.Add(1))
	if _, err := db.ExecContext(context.Background(), `
		INSERT INTO users (user_uuid, user_tenant_id, user_full_name, user_phone_number)
		SELECT $1, tenant_id, 'KYC Test Customer', $2 FROM tenants WHERE tenant_uuid = $3`,
		userUUID, phone, database.SeedDemoTenantUUID); err != nil {
		t.Fatalf("insert kyc customer: %v", err)
	}
	return userUUID, customerToken(t, userUUID, phone)
}

func kycStatus(t *testing.T, token string) string {
	t.Helper()
	r := call(t, "GET", "/user/kyc", token, database.SeedDemoTenantUUID, nil)
	expectStatus(t, r, http.StatusOK)
	return str(r.Body["kyc_status"])
}

func submitKYC(t *testing.T, token string, body map[string]any) response {
	t.Helper()
	return call(t, "POST", "/user/kyc", token, database.SeedDemoTenantUUID, body)
}

var validKYC = map[string]any{"pan_number": "abcde1234f", "aadhaar_last4": "1234"}

func TestKYC_NewCustomerIsNotStartedUntilSubmitted(t *testing.T) {
	_, token := newKYCCustomer(t)

	if got := kycStatus(t, token); got != "not_started" {
		t.Fatalf("new customer kyc_status = %q, want not_started (DB default 'pending' is not a submission)", got)
	}

	expectStatus(t, submitKYC(t, token, validKYC), http.StatusOK)
	if got := kycStatus(t, token); got != "pending" {
		t.Fatalf("after submit kyc_status = %q, want pending", got)
	}
}

func TestKYC_StoresOnlyValidatedFields(t *testing.T) {
	userUUID, token := newKYCCustomer(t)

	expectError(t, submitKYC(t, token, map[string]any{"pan_number": "BAD", "aadhaar_last4": "1234"}),
		http.StatusBadRequest, "INVALID_INPUT")
	expectError(t, submitKYC(t, token, map[string]any{"pan_number": "ABCDE1234F", "aadhaar_last4": "12a4"}),
		http.StatusBadRequest, "INVALID_INPUT")

	body := map[string]any{"pan_number": " abcde1234f ", "aadhaar_last4": "1234", "document_url": "https://evil.example/x", "is_admin": true}
	expectStatus(t, submitKYC(t, token, body), http.StatusOK)

	var stored string
	if err := db.QueryRowContext(context.Background(),
		`SELECT user_document_json::text FROM users WHERE user_uuid = $1`, userUUID).Scan(&stored); err != nil {
		t.Fatalf("read stored kyc: %v", err)
	}
	want := `{"pan_number": "ABCDE1234F", "aadhaar_last4": "1234"}`
	if stored != want {
		t.Fatalf("stored document = %s, want %s (normalised, unknown fields dropped)", stored, want)
	}
}

func TestKYC_CannotResubmitWhilePendingOrVerified(t *testing.T) {
	userUUID, token := newKYCCustomer(t)
	expectStatus(t, submitKYC(t, token, validKYC), http.StatusOK)

	// Already under review: a second submission must not overwrite it.
	expectError(t, submitKYC(t, token, validKYC), http.StatusConflict, "KYC_NOT_SUBMITTABLE")

	r := call(t, "POST", "/admin/store/kyc/approve", demoManager(t), database.SeedDemoTenantUUID,
		map[string]any{"user_uuid": userUUID})
	expectStatus(t, r, http.StatusOK)

	// Read-after-write through the user cache: approval must be visible immediately.
	if got := kycStatus(t, token); got != "verified" {
		t.Fatalf("after approval kyc_status = %q, want verified", got)
	}

	// A verified customer resubmitting used to drop back to pending.
	expectError(t, submitKYC(t, token, validKYC), http.StatusConflict, "KYC_NOT_SUBMITTABLE")
	if got := kycStatus(t, token); got != "verified" {
		t.Fatalf("after rejected resubmit kyc_status = %q, want verified", got)
	}
}

func TestKYC_RejectedCustomerCanResubmit(t *testing.T) {
	userUUID, token := newKYCCustomer(t)
	expectStatus(t, submitKYC(t, token, validKYC), http.StatusOK)

	r := call(t, "POST", "/admin/store/kyc/reject", demoManager(t), database.SeedDemoTenantUUID,
		map[string]any{"user_uuid": userUUID})
	expectStatus(t, r, http.StatusOK)
	if got := kycStatus(t, token); got != "rejected" {
		t.Fatalf("after rejection kyc_status = %q, want rejected", got)
	}

	expectStatus(t, submitKYC(t, token, validKYC), http.StatusOK)
	if got := kycStatus(t, token); got != "pending" {
		t.Fatalf("after resubmit kyc_status = %q, want pending", got)
	}
}

func TestKYC_PendingQueueListsOnlySubmissions(t *testing.T) {
	submittedUUID, submittedToken := newKYCCustomer(t)
	idleUUID, _ := newKYCCustomer(t)
	expectStatus(t, submitKYC(t, submittedToken, validKYC), http.StatusOK)

	r := call(t, "GET", "/admin/store/kyc/pending?limit=100", demoManager(t), database.SeedDemoTenantUUID, nil)
	expectStatus(t, r, http.StatusOK)

	listed := map[string]bool{}
	rows, _ := r.Body["data"].([]any)
	for _, row := range rows {
		if m, ok := row.(map[string]any); ok {
			listed[str(m["user_uuid"])] = true
		}
	}
	if !listed[submittedUUID] {
		t.Fatalf("submitted customer missing from the pending queue: %v", r.Body)
	}
	if listed[idleUUID] {
		t.Fatalf("customer who never submitted KYC is in the pending queue: %v", r.Body)
	}
}

func TestOnlineBuy_UpfrontTenantRequiresKYCForAnyAmount(t *testing.T) {
	ctx := context.Background()
	if _, err := db.ExecContext(ctx,
		`UPDATE tenants SET tenant_kyc_mode = 'upfront' WHERE tenant_uuid = $1`, database.SeedDemoTenantUUID); err != nil {
		t.Fatalf("set upfront kyc mode: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.ExecContext(ctx,
			`UPDATE tenants SET tenant_kyc_mode = 'just_in_time' WHERE tenant_uuid = $1`, database.SeedDemoTenantUUID)
	})

	r := call(t, "POST", "/trade/buy/initiate", pendingCustomer(t), database.SeedDemoTenantUUID, map[string]any{
		"total_amount_inr":        1000,
		"requested_rate_per_gram": demoBuyRate,
	})
	expectError(t, r, http.StatusForbidden, "KYC_REQUIRED")
}

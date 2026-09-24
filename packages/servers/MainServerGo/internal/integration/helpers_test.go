//go:build integration

package integration

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"math"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/pquerna/otp/totp"

	"github.com/rpsoftech/DigiGold/MainServerGo/internal/constants"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/database"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/service"
)

// Demo store buy price with the seeded rate: (7000 ask + ₹100 margin) × 1.03 GST.
const demoBuyRate = 7313.0

// response is a decoded API response.
type response struct {
	Status int
	Body   map[string]any
}

// call sends a JSON request to the in-process app. token goes in X-Api-Token and
// tenantUUID in X-Tenant-ID; pass "" to leave a header out.
func call(t *testing.T, method, path, token, tenantUUID string, body any) response {
	t.Helper()
	var reader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal body: %v", err)
		}
		reader = bytes.NewReader(b)
	}
	req := httptest.NewRequest(method, "/api/v1"+path, reader)
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("X-Api-Token", token)
	}
	if tenantUUID != "" {
		req.Header.Set("X-Tenant-ID", tenantUUID)
	}
	return send(t, req)
}

func send(t *testing.T, req *http.Request) response {
	t.Helper()
	resp, err := app.Test(req, fiber.TestConfig{Timeout: 10 * time.Second})
	if err != nil {
		t.Fatalf("%s %s: %v", req.Method, req.URL.Path, err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	out := response{Status: resp.StatusCode, Body: map[string]any{}}
	_ = json.Unmarshal(raw, &out.Body)
	return out
}

// expectStatus fails the test when the response status is not want.
func expectStatus(t *testing.T, r response, want int) {
	t.Helper()
	if r.Status != want {
		t.Fatalf("status = %d, want %d; body = %v", r.Status, want, r.Body)
	}
}

// expectError fails the test unless the response has status and error name.
func expectError(t *testing.T, r response, status int, name string) {
	t.Helper()
	expectStatus(t, r, status)
	if got, _ := r.Body["name"].(string); got != name {
		t.Fatalf("error name = %q, want %q; body = %v", got, name, r.Body)
	}
}

// customerToken mints an access token for a seeded customer of the demo store.
// (The OTP login itself needs WhatsApp, which the tests do not have.)
func customerToken(t *testing.T, userUUID, phone string) string {
	t.Helper()
	access, _, err := service.GetJWTService().GenerateTokens(userUUID, database.SeedDemoTenantUUID, phone)
	if err != nil {
		t.Fatalf("mint customer token: %v", err)
	}
	return access
}

func verifiedCustomer(t *testing.T) string {
	return customerToken(t, database.SeedVerifiedCustomerUUID, database.SeedVerifiedCustomerPhone)
}

func pendingCustomer(t *testing.T) string {
	return customerToken(t, database.SeedPendingCustomerUUID, database.SeedPendingCustomerPhone)
}

var (
	adminTokensMu sync.Mutex
	adminTokens   = map[string]string{}
)

// adminToken logs a seeded admin in through the real password + TOTP flow and
// caches the token (the auth routes allow 10 requests per minute).
func adminToken(t *testing.T, username, tenantUUID string) string {
	t.Helper()
	adminTokensMu.Lock()
	defer adminTokensMu.Unlock()
	if tok, ok := adminTokens[username]; ok {
		return tok
	}

	login := call(t, "POST", "/admin/auth/login", "", tenantUUID, map[string]string{
		"username": username, "password": adminPassword,
	})
	expectStatus(t, login, http.StatusOK)
	tempToken, _ := login.Body["temp_token"].(string)

	code, err := totp.GenerateCode(adminTOTPSecret, time.Now())
	if err != nil {
		t.Fatalf("totp: %v", err)
	}
	verify := call(t, "POST", "/admin/auth/totp/verify", "", tenantUUID, map[string]string{
		"temp_token": tempToken, "code": code,
	})
	expectStatus(t, verify, http.StatusOK)
	tok, _ := verify.Body["access_token"].(string)
	if tok == "" {
		t.Fatalf("no access_token in %v", verify.Body)
	}
	adminTokens[username] = tok
	return tok
}

func demoManager(t *testing.T) string {
	return adminToken(t, database.SeedDemoManagerUsername, database.SeedDemoTenantUUID)
}

// balance reads a customer's vault balance straight from the database.
func balance(t *testing.T, userUUID string) float64 {
	t.Helper()
	var grams float64
	if err := db.QueryRow(`SELECT user_total_vault_balance FROM users WHERE user_uuid = $1`, userUUID).Scan(&grams); err != nil {
		t.Fatalf("read balance: %v", err)
	}
	return grams
}

func expectGrams(t *testing.T, label string, got, want float64) {
	t.Helper()
	if math.Abs(got-want) > 0.00005 {
		t.Fatalf("%s = %.4f g, want %.4f g", label, got, want)
	}
}

// setLiveRate writes the GOLD rate the trade service prices from.
func setLiveRate(t *testing.T, ask, bid float64) {
	t.Helper()
	rate, _ := json.Marshal(map[string]float64{"ask": ask, "bid": bid, "last-high": ask, "last-low": bid})
	if err := rdb.HSet(context.Background(), constants.RedisKeyLatestRawRate, "GOLD", string(rate)).Err(); err != nil {
		t.Fatalf("set rate: %v", err)
	}
}

// counterBuy gives a demo customer gold through a counter cash buy and returns the ledger entry.
func counterBuy(t *testing.T, userUUID string, grams float64) map[string]any {
	t.Helper()
	r := call(t, "POST", "/admin/store/trade/counter", demoManager(t), database.SeedDemoTenantUUID, map[string]any{
		"user_uuid":               userUUID,
		"requested_rate_per_gram": demoBuyRate,
		"weight_grams":            grams,
		"payment_mode":            "COUNTER_CASH",
	})
	expectStatus(t, r, http.StatusOK)
	trade, _ := r.Body["trade"].(map[string]any)
	return trade
}

// webhook posts a Razorpay payment.captured event for an order, signed with secret.
func webhook(t *testing.T, orderID, paymentID string, amountPaise int64, secret string) response {
	t.Helper()
	order, ok := razorpay.order(orderID)
	if !ok {
		t.Fatalf("unknown order %s", orderID)
	}
	body, _ := json.Marshal(map[string]any{
		"event": "payment.captured",
		"payload": map[string]any{"payment": map[string]any{"entity": map[string]any{
			"id":       paymentID,
			"order_id": orderID,
			"amount":   amountPaise,
			"notes":    order.Notes,
		}}},
	})
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)

	req := httptest.NewRequest("POST", "/api/v1/webhook/razorpay", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Razorpay-Signature", hex.EncodeToString(mac.Sum(nil)))
	return send(t, req)
}

// eventExists reports whether system_events has an event of this name whose
// payload field equals value.
func eventExists(t *testing.T, eventName, field, value string) bool {
	t.Helper()
	var exists bool
	err := db.QueryRow(`SELECT EXISTS (SELECT 1 FROM system_events WHERE event_name = $1 AND payload->>$2 = $3)`,
		eventName, field, value).Scan(&exists)
	if err != nil {
		t.Fatalf("query events: %v", err)
	}
	return exists
}

func num(v any) float64 {
	f, _ := v.(float64)
	return f
}

func str(v any) string {
	s, _ := v.(string)
	return s
}

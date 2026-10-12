//go:build integration

package integration

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/pquerna/otp"
	"github.com/pquerna/otp/totp"

	"github.com/rpsoftech/DigiGold/MainServerGo/events"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/database"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/service"
)

// unliftedGrams reads a store's unlifted grams straight from margin_configurations.
func unliftedGrams(t *testing.T, tenantUUID string) float64 {
	t.Helper()
	var grams float64
	if err := db.QueryRow(`
		SELECT mc_tenant_unlifted_grams FROM margin_configurations
		WHERE mc_commodity_type = 'GOLD'
		  AND mc_tenant_id = (SELECT tenant_id FROM tenants WHERE tenant_uuid = $1)`, tenantUUID).Scan(&grams); err != nil {
		t.Fatalf("read unlifted grams: %v", err)
	}
	return grams
}

// The seeded platform tenant has no margin row, so the demo store's mc_id differs from its
// tenant_id. The unlifted-grams update used to match mc_tenant_id against mc_id: demo trades
// changed no row and the other store's trades changed demo's.
func TestUnliftedGramsFollowTheTradingStore(t *testing.T) {
	var marginID, tenantID int64
	if err := db.QueryRow(`
		SELECT mc.mc_id, t.tenant_id FROM margin_configurations mc
		JOIN tenants t ON t.tenant_id = mc.mc_tenant_id
		WHERE t.tenant_uuid = $1 AND mc.mc_commodity_type = 'GOLD'`, database.SeedDemoTenantUUID).Scan(&marginID, &tenantID); err != nil {
		t.Fatal(err)
	}
	if marginID == tenantID {
		t.Fatalf("seed no longer gives the demo store a margin id (%d) different from its tenant id; the test needs one", marginID)
	}

	demoBefore := unliftedGrams(t, database.SeedDemoTenantUUID)
	otherBefore := unliftedGrams(t, database.SeedOtherTenantUUID)

	counterBuy(t, database.SeedVerifiedCustomerUUID, 1.5)

	expectGrams(t, "demo unlifted grams", unliftedGrams(t, database.SeedDemoTenantUUID), demoBefore+1.5)
	expectGrams(t, "other store's unlifted grams", unliftedGrams(t, database.SeedOtherTenantUUID), otherBefore)
}

// Cancelling a pickup returns grams to the store's unlifted total. It must work even when the
// store is at (or over) its credit limit, or the customer's gold would be stuck.
func TestRedemption_CancelWorksWhenTheStoreIsAtItsCreditLimit(t *testing.T) {
	counterBuy(t, database.SeedVerifiedCustomerUUID, 1)
	before := balance(t, database.SeedVerifiedCustomerUUID)
	rr := requestRedemption(t, verifiedCustomer(t), 1)

	const demoMargin = `WHERE mc_tenant_id = (SELECT tenant_id FROM tenants WHERE tenant_uuid = $1)`
	var limit float64
	if err := db.QueryRow(`SELECT mc_tenant_credit_limit_grams FROM margin_configurations `+demoMargin,
		database.SeedDemoTenantUUID).Scan(&limit); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`UPDATE margin_configurations SET mc_tenant_credit_limit_grams = mc_tenant_unlifted_grams `+demoMargin,
		database.SeedDemoTenantUUID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(`UPDATE margin_configurations SET mc_tenant_credit_limit_grams = $2 `+demoMargin,
			database.SeedDemoTenantUUID, limit)
	})

	r := call(t, "POST", "/trade/redemptions/"+str(rr["redemption_uuid"])+"/cancel", verifiedCustomer(t), database.SeedDemoTenantUUID, nil)
	expectStatus(t, r, http.StatusOK)
	expectGrams(t, "balance after cancel", balance(t, database.SeedVerifiedCustomerUUID), before)
}

// A captured-payment webhook repeated after its 24-hour Redis lock is gone (or after Redis
// lost it) must neither credit the payment again nor refund it.
func TestOnlineBuy_WebhookRepeatedAfterTheLockExpiresDoesNothing(t *testing.T) {
	setLiveRate(t, 7000, 6950)
	before := balance(t, database.SeedVerifiedCustomerUUID)
	orderID, weight := initiateBuy(t, 700)

	paymentID := razorpay.newPaymentID()
	expectStatus(t, webhook(t, orderID, paymentID, 70000, webhookSecret), http.StatusOK)
	expectGrams(t, "balance after capture", balance(t, database.SeedVerifiedCustomerUUID), before+weight)

	if err := rdb.Del(context.Background(), "digiGold:lock:payment:"+paymentID).Err(); err != nil {
		t.Fatal(err)
	}
	expectStatus(t, webhook(t, orderID, paymentID, 70000, webhookSecret), http.StatusOK)

	expectGrams(t, "balance after the repeated webhook", balance(t, database.SeedVerifiedCustomerUUID), before+weight)
	if refund, refunded := razorpay.refundFor(paymentID); refunded {
		t.Fatalf("a credited payment was refunded: %+v", refund)
	}
}

// A refunded payment's webhook repeated after the lock expired must not be refunded twice.
func TestOnlineBuy_RefundIsNotRepeated(t *testing.T) {
	orderID, _ := initiateBuy(t, 400)
	paymentID := razorpay.newPaymentID()

	expectStatus(t, webhook(t, orderID, paymentID, 100, webhookSecret), http.StatusOK) // amount mismatch: refunded
	if _, ok := razorpay.refundFor(paymentID); !ok {
		t.Fatal("the mismatched payment was not refunded")
	}
	requestsBefore := razorpay.refundRequestCount(paymentID)

	if err := rdb.Del(context.Background(), "digiGold:lock:payment:"+paymentID).Err(); err != nil {
		t.Fatal(err)
	}
	expectStatus(t, webhook(t, orderID, paymentID, 100, webhookSecret), http.StatusOK)
	// The recorded refund stops the repeat before Razorpay is asked again (Razorpay would
	// refuse a second refund anyway, so counting issued refunds would not show it).
	if got := razorpay.refundRequestCount(paymentID); got != requestsBefore {
		t.Fatalf("refund requests for the payment = %d, want %d (Razorpay not asked again)", got, requestsBefore)
	}
}

// A payment refunded at Razorpay without a TRADE_PAYMENT_REFUNDED event (the event save
// failed after the refund) is settled when its webhook comes again: Razorpay refuses the
// second refund, and the server records the refund instead of failing on every retry.
func TestOnlineBuy_RefundAlreadyMadeAtRazorpayIsSettled(t *testing.T) {
	orderID, _ := initiateBuy(t, 400)
	paymentID := razorpay.newPaymentID()
	razorpay.refundOutsideTheServer(paymentID, 100)

	expectStatus(t, webhook(t, orderID, paymentID, 100, webhookSecret), http.StatusOK) // amount mismatch: refund
	if got := razorpay.refundCount(paymentID); got != 1 {
		t.Fatalf("refunds for the payment = %d, want 1", got)
	}
	if !eventExists(t, events.TradeEventPaymentRefunded, "payment_id", paymentID) {
		t.Fatal("the refund was not recorded")
	}
}

// Checkout must open with the account the order was created on: the tenant's own key.
func TestOnlineBuy_InitiateReturnsTheTenantKeyID(t *testing.T) {
	r := call(t, "POST", "/trade/buy/initiate", verifiedCustomer(t), database.SeedDemoTenantUUID, map[string]any{
		"total_amount_inr":        300,
		"requested_rate_per_gram": demoBuyRate,
	})
	expectStatus(t, r, http.StatusOK)
	if got := str(r.Body["key_id"]); got != "rzp_test_key" {
		t.Fatalf("key_id = %q, want the demo tenant's rzp_test_key", got)
	}
}

// tenantCall is a platform admin request to /admin/tenants.
func tenantCall(t *testing.T, method, path string, body any) response {
	t.Helper()
	return call(t, method, "/admin/tenants"+path, platformAdmin(t), database.SeedPlatformTenantUUID, body)
}

// onboardStore creates a store through the API and returns its UUID.
func onboardStore(t *testing.T, shortName, adminUsername, adminPhone string) string {
	t.Helper()
	r := tenantCall(t, "POST", "/stub", map[string]any{
		"tenant": map[string]any{"full_name": "Store " + shortName, "short_name": shortName},
		"admin_user": map[string]any{
			"username": adminUsername, "phone_number": adminPhone, "password": adminPassword,
		},
	})
	expectStatus(t, r, http.StatusCreated)
	tenantUUID := str(r.Body["tenant_uuid"])
	if tenantUUID == "" || str(r.Body["admin_uuid"]) == "" {
		t.Fatalf("stub response = %v, want tenant_uuid and admin_uuid", r.Body)
	}
	return tenantUUID
}

// A store created through the API gets a root admin who can sign in with the password given
// and enrol TOTP. (The admin used to be created with TOTP "enabled" but no secret and no
// password, so neither setup nor verify could ever succeed.) The service is called directly:
// the admin auth routes' 10-per-minute limit is spent by the other admin tests.
func TestOnboardedStoreAdminCanSignInAndEnrolTOTP(t *testing.T) {
	const username = "onboarded-root"
	tenantUUID := onboardStore(t, "onboarded", username, "9000000081")

	var tenantID int64
	if err := db.QueryRow(`SELECT tenant_id FROM tenants WHERE tenant_uuid = $1`, tenantUUID).Scan(&tenantID); err != nil {
		t.Fatal(err)
	}
	auth := service.InitAdminAuthService()
	ctx := context.Background()

	tempToken, totpEnabled, err := auth.AdminLogin(ctx, tenantID, username, adminPassword)
	if err != nil {
		t.Fatalf("root admin cannot sign in with the onboarding password: %v", err)
	}
	if totpEnabled {
		t.Fatal("a new root admin must enrol TOTP on first login (totp_enabled=false)")
	}
	_, uri, err := auth.SetupTOTP(ctx, tempToken)
	if err != nil {
		t.Fatalf("TOTP setup: %v", err)
	}
	key, err := otp.NewKeyFromURL(uri)
	if err != nil {
		t.Fatal(err)
	}
	code, err := totp.GenerateCode(key.Secret(), time.Now())
	if err != nil {
		t.Fatal(err)
	}
	access, _, err := auth.VerifyTOTP(ctx, tempToken, code, "127.0.0.1")
	if err != nil || access == "" {
		t.Fatalf("TOTP verify: %v", err)
	}

	var role string
	if err := db.QueryRow(`SELECT tu_role FROM tenant_user_logins WHERE tu_tenant_id = $1 AND tu_username = $2`,
		tenantID, username).Scan(&role); err != nil || role != "manager" {
		t.Fatalf("root admin role = %q (%v), want manager", role, err)
	}

	// The same short name or admin username again is a conflict, not a server error.
	dup := tenantCall(t, "POST", "/stub", map[string]any{
		"tenant":     map[string]any{"full_name": "Copy", "short_name": "onboarded"},
		"admin_user": map[string]any{"username": "someone", "phone_number": "9000000082", "password": adminPassword},
	})
	expectError(t, dup, http.StatusConflict, "TENANT_ALREADY_EXISTS")

	weak := tenantCall(t, "POST", "/stub", map[string]any{
		"tenant":     map[string]any{"full_name": "Weak", "short_name": "weak-pass"},
		"admin_user": map[string]any{"username": "weak", "phone_number": "9000000083", "password": "short"},
	})
	expectError(t, weak, http.StatusBadRequest, "INVALID_INPUT")
}

// A profile update changes only the fields sent; the storefront layout and the rest stay.
func TestTenantProfileUpdateKeepsOmittedFields(t *testing.T) {
	tenantUUID := onboardStore(t, "profile-store", "profile-root", "9000000084")
	layout := []any{map[string]any{"type": "hero", "title": "Welcome"}}
	expectStatus(t, tenantCall(t, "PATCH", "/"+tenantUUID+"/ui-layout", map[string]any{"ui_json_config": layout}), http.StatusOK)

	expectStatus(t, tenantCall(t, "PATCH", "/"+tenantUUID+"/profile", map[string]any{"full_name": "Renamed Store"}), http.StatusOK)

	detail := tenantCall(t, "GET", "/"+tenantUUID, nil)
	expectStatus(t, detail, http.StatusOK)
	data, _ := detail.Body["data"].(map[string]any)
	if str(data["full_name"]) != "Renamed Store" || str(data["short_name"]) != "profile-store" {
		t.Fatalf("tenant = %v, want the new name and the old short name", data)
	}
	gotLayout, _ := json.Marshal(data["ui_json_config"])
	wantLayout, _ := json.Marshal(layout)
	if string(gotLayout) != string(wantLayout) {
		t.Fatalf("ui_json_config = %s, want %s (kept)", gotLayout, wantLayout)
	}
	if _, leaked := data["id"]; leaked {
		t.Fatal("the internal tenant id must not appear in responses")
	}
}

// Suspending a store refuses its customers and staff; reactivating lets them back in.
func TestTenantSuspensionRefusesTheStore(t *testing.T) {
	tenantUUID := onboardStore(t, "suspend-store", "suspend-root", "9000000085")
	expectStatus(t, call(t, "GET", "/tenant/info", "", tenantUUID, nil), http.StatusOK)

	expectStatus(t, tenantCall(t, "PATCH", "/"+tenantUUID+"/status", map[string]any{"is_active": false}), http.StatusOK)
	expectError(t, call(t, "GET", "/tenant/info", "", tenantUUID, nil), http.StatusForbidden, "TENANT_INACTIVE")
	if !eventExists(t, events.TenantDeactivatedEvent, "tenant_uuid", tenantUUID) {
		t.Fatal("no TENANT_DEACTIVATED event")
	}

	// The status endpoint changes nothing else about the store.
	detail := tenantCall(t, "GET", "/"+tenantUUID, nil)
	data, _ := detail.Body["data"].(map[string]any)
	if str(data["full_name"]) != "Store suspend-store" || data["is_active"] != false {
		t.Fatalf("tenant after suspension = %v", data)
	}

	expectStatus(t, tenantCall(t, "PATCH", "/"+tenantUUID+"/status", map[string]any{"is_active": true}), http.StatusOK)
	expectStatus(t, call(t, "GET", "/tenant/info", "", tenantUUID, nil), http.StatusOK)

	expectStatus(t, tenantCall(t, "PATCH", "/"+tenantUUID+"/status", map[string]any{}), http.StatusBadRequest)
}

// Tenant KYC documents can be added, decided and listed (the repository used columns the
// table never had, so every call failed).
func TestTenantKYCDocumentLifecycle(t *testing.T) {
	tenantUUID := onboardStore(t, "kyc-store", "kyc-root", "9000000086")

	added := tenantCall(t, "POST", "/"+tenantUUID+"/kyc", map[string]any{
		"tkd_document_type": "PAN", "tkd_document_url": "https://files.example.com/pan.pdf",
	})
	expectStatus(t, added, http.StatusCreated)
	docUUID := str(added.Body["tkd_uuid"])

	expectStatus(t, tenantCall(t, "PATCH", "/"+tenantUUID+"/kyc/verify", map[string]any{
		"tkd_uuid": docUUID, "tkd_status": "VERIFIED",
	}), http.StatusOK)
	expectStatus(t, tenantCall(t, "PATCH", "/"+tenantUUID+"/kyc/verify", map[string]any{
		"tkd_uuid": docUUID, "tkd_status": "MAYBE",
	}), http.StatusBadRequest)

	list := tenantCall(t, "GET", "/"+tenantUUID+"/kyc", nil)
	expectStatus(t, list, http.StatusOK)
	docs, _ := list.Body["data"].([]any)
	if len(docs) != 1 {
		t.Fatalf("documents = %v, want 1", docs)
	}
	doc := docs[0].(map[string]any)
	if str(doc["tkd_status"]) != "VERIFIED" || str(doc["tkd_verified_by"]) != database.SeedPlatformAdminUUID {
		t.Fatalf("document = %v, want VERIFIED by the platform admin's UUID", doc)
	}
	if _, leaked := doc["tkd_tenant_id"]; leaked {
		t.Fatal("the internal tenant id must not appear in responses")
	}
}

// A changed gateway config takes effect at once (it used to stay cached for 24 hours under a
// key nothing invalidated), and its secrets are not copied into the event log.
func TestTenantConfigUpdateIsUsedAtOnceAndRedactedInTheLog(t *testing.T) {
	tenantUUID := onboardStore(t, "config-store", "config-root", "9000000087")
	repoConfig := func() string {
		cfg, err := service.GetTenantConfigService().ConfigRepo.GetConfigByTenantUUID(context.Background(), tenantUUID)
		if err != nil || cfg.PaymentConfig == nil {
			return ""
		}
		return cfg.PaymentConfig.KeyID
	}
	_ = repoConfig() // cache the initial (empty) config

	expectStatus(t, tenantCall(t, "PATCH", "/"+tenantUUID+"/config", map[string]any{
		"payment_config": map[string]any{
			"provider_type": "CUSTOM", "key_id": "rzp_test_new", "key_secret": "very-secret", "webhook_secret": "hook-secret",
		},
	}), http.StatusOK)

	if got := repoConfig(); got != "rzp_test_new" {
		t.Fatalf("config key_id = %q right after the update, want rzp_test_new", got)
	}
	var leaked bool
	if err := db.QueryRow(`
		SELECT EXISTS (SELECT 1 FROM system_events
		WHERE event_name = 'TenantConfigUpdated' AND tenant_id = $1
		  AND (payload::text LIKE '%very-secret%' OR payload::text LIKE '%hook-secret%'))`, tenantUUID).Scan(&leaked); err != nil {
		t.Fatal(err)
	}
	if leaked {
		t.Fatal("gateway secrets were stored in the TenantConfigUpdated event")
	}
}

// otpSessionCode reads the live OTP for a phone the way the WhatsApp worker does.
func otpSessionCode(t *testing.T, tenantUUID, phone string) (code, reqID string) {
	t.Helper()
	raw, err := rdb.Get(context.Background(), fmt.Sprintf("%stenant:%s:otp_session:%s", os.Getenv("REDIS_DEFAULT_KEY"), tenantUUID, phone)).Result()
	if err != nil {
		t.Fatalf("read OTP session: %v", err)
	}
	var session struct {
		OtpCode string `json:"otpCode"`
		ReqID   string `json:"reqId"`
	}
	if err := json.Unmarshal([]byte(raw), &session); err != nil {
		t.Fatal(err)
	}
	return session.OtpCode, session.ReqID
}

// OTP login issues a session whose refresh token works exactly once and stops working on
// logout. The OTP itself is read from Redis (WhatsApp isn't available here) and must not be
// stored in the event log.
func TestCustomerSessionRefreshAndLogout(t *testing.T) {
	const phone = database.SeedVerifiedCustomerPhone
	expectStatus(t, call(t, "POST", "/auth/otp/request", "", database.SeedDemoTenantUUID, map[string]string{"phone": phone}), http.StatusOK)

	code, reqID := otpSessionCode(t, database.SeedDemoTenantUUID, phone)
	var storedCode *string
	if err := db.QueryRow(`SELECT payload->>'otpCode' FROM system_events WHERE event_name = 'OTPReqEvent' AND key_id = $1`,
		reqID).Scan(&storedCode); err != nil {
		t.Fatalf("OTP event: %v", err)
	}
	if storedCode != nil && *storedCode != "" {
		t.Fatal("the OTP request event must not store the code")
	}

	login := call(t, "POST", "/auth/otp/verify", "", database.SeedDemoTenantUUID, map[string]string{"phone": phone, "otp": code})
	expectStatus(t, login, http.StatusOK)
	refreshToken := str(login.Body["refresh_token"])

	refreshed := call(t, "POST", "/auth/refresh", "", database.SeedDemoTenantUUID, map[string]string{"refresh_token": refreshToken})
	expectStatus(t, refreshed, http.StatusOK)
	newRefresh := str(refreshed.Body["refresh_token"])
	if str(refreshed.Body["access_token"]) == "" || newRefresh == "" || newRefresh == refreshToken {
		t.Fatalf("refresh = %v, want a new token pair", refreshed.Body)
	}
	portfolio := call(t, "GET", "/user/portfolio", str(refreshed.Body["access_token"]), database.SeedDemoTenantUUID, nil)
	expectStatus(t, portfolio, http.StatusOK)

	// Single use: the old token is spent.
	expectError(t, call(t, "POST", "/auth/refresh", "", database.SeedDemoTenantUUID, map[string]string{"refresh_token": refreshToken}),
		http.StatusUnauthorized, "REFRESH_TOKEN_INVALID")
	// Another tenant can't use it.
	expectError(t, call(t, "POST", "/auth/refresh", "", database.SeedOtherTenantUUID, map[string]string{"refresh_token": newRefresh}),
		http.StatusUnauthorized, "REFRESH_TOKEN_INVALID")

	expectStatus(t, call(t, "POST", "/auth/logout", "", database.SeedDemoTenantUUID, map[string]string{"refresh_token": newRefresh}), http.StatusOK)
	expectError(t, call(t, "POST", "/auth/refresh", "", database.SeedDemoTenantUUID, map[string]string{"refresh_token": newRefresh}),
		http.StatusUnauthorized, "REFRESH_TOKEN_INVALID")
}

// Phone numbers and codes are validated, and a code allows five guesses in total.
func TestOTPInputValidationAndGuessLimit(t *testing.T) {
	expectError(t, call(t, "POST", "/auth/otp/request", "", database.SeedDemoTenantUUID, map[string]string{"phone": "+91987654"}),
		http.StatusBadRequest, "INVALID_INPUT")

	const phone = "9000000091"
	expectStatus(t, call(t, "POST", "/auth/otp/request", "", database.SeedDemoTenantUUID, map[string]string{"phone": phone}), http.StatusOK)
	code, _ := otpSessionCode(t, database.SeedDemoTenantUUID, phone)
	wrong := "000000"
	if code == wrong {
		wrong = "111111"
	}
	for i := 0; i < 5; i++ {
		expectError(t, call(t, "POST", "/auth/otp/verify", "", database.SeedDemoTenantUUID, map[string]string{"phone": phone, "otp": wrong}),
			http.StatusUnauthorized, "ERROR_OTP_INVALID")
	}
	// The sixth attempt is refused even with the right code: the OTP is burnt.
	expectError(t, call(t, "POST", "/auth/otp/verify", "", database.SeedDemoTenantUUID, map[string]string{"phone": phone, "otp": code}),
		http.StatusTooManyRequests, "ERROR_MAX_VERIFY_ATTEMPTS")
}

// Bootstrap is idempotent on a database that already has the platform tenant and a super_admin.
func TestBootstrapIsIdempotent(t *testing.T) {
	result, err := database.Bootstrap(context.Background(), db, database.BootstrapOptions{
		AdminUsername: "first-platform-admin", AdminPhone: "9000000099", AdminPassword: "a-long-bootstrap-password",
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.PlatformTenantUUID != database.SeedPlatformTenantUUID || result.TenantCreated || result.AdminCreated {
		t.Fatalf("bootstrap = %+v, want the seeded platform tenant and no new rows", result)
	}
	if _, err := database.Bootstrap(context.Background(), db, database.BootstrapOptions{
		AdminUsername: "x", AdminPhone: "1", AdminPassword: "short",
	}); err == nil {
		t.Fatal("bootstrap accepted a short password")
	}
}

// A store's manager manages that store's staff (only): adds managers, lists and deactivates
// them, but can't create or change a super_admin, reach another store, or lock themselves out.
func TestManagerManagesOwnStoreStaff(t *testing.T) {
	manager := demoManager(t)
	staff := func(method, path string, body any) response {
		return call(t, method, "/admin/admins"+path, manager, database.SeedDemoTenantUUID, body)
	}

	created := staff("POST", "", map[string]any{
		"username": "counter-staff-1", "phone_number": "9000000095", "password": adminPassword, "role": "manager",
	})
	expectStatus(t, created, http.StatusCreated)
	newAdmin := str(created.Body["data"].(map[string]any)["admin_uuid"])

	var tenantUUID string
	if err := db.QueryRow(`SELECT t.tenant_uuid::text FROM tenant_user_logins tu JOIN tenants t ON t.tenant_id = tu.tu_tenant_id WHERE tu.tu_uuid = $1`,
		newAdmin).Scan(&tenantUUID); err != nil || tenantUUID != database.SeedDemoTenantUUID {
		t.Fatalf("new staff tenant = %q (%v), want the manager's own store", tenantUUID, err)
	}

	expectError(t, staff("POST", "", map[string]any{
		"username": "sneaky-root", "phone_number": "9000000096", "password": adminPassword, "role": "super_admin",
	}), http.StatusForbidden, "ROLE_NOT_AUTHORIZED")
	expectError(t, staff("POST", "", map[string]any{
		"tenant_uuid": database.SeedOtherTenantUUID,
		"username":    "elsewhere", "phone_number": "9000000097", "password": adminPassword, "role": "manager",
	}), http.StatusForbidden, "TENANT_MISMATCH")
	expectError(t, staff("GET", "?tenant_uuid="+database.SeedOtherTenantUUID, nil), http.StatusForbidden, "TENANT_MISMATCH")

	list := staff("GET", "?limit=100", nil)
	expectStatus(t, list, http.StatusOK)
	found := false
	for _, item := range list.Body["data"].([]any) {
		row := item.(map[string]any)
		if str(row["username"]) == database.SeedOtherManagerUsername || str(row["username"]) == database.SeedPlatformAdminUsername {
			t.Fatalf("a manager's staff list includes %s from another store", row["username"])
		}
		if str(row["admin_uuid"]) == newAdmin {
			found = true
		}
	}
	if !found {
		t.Fatal("the new staff member is missing from the store's list")
	}

	expectStatus(t, staff("PATCH", "/"+newAdmin, map[string]any{"is_active": false}), http.StatusOK)
	expectError(t, staff("PATCH", "/"+database.SeedDemoManagerUUID, map[string]any{"is_active": false}),
		http.StatusBadRequest, "CANNOT_CHANGE_OWN_ACCOUNT")
	expectError(t, staff("PATCH", "/"+newAdmin, map[string]any{"role": "super_admin"}),
		http.StatusForbidden, "ROLE_NOT_AUTHORIZED")

	// Duplicate username in the same store: a clear conflict.
	expectError(t, staff("POST", "", map[string]any{
		"username": "counter-staff-1", "phone_number": "9000000098", "password": adminPassword, "role": "manager",
	}), http.StatusConflict, "ADMIN_ALREADY_EXISTS")
}

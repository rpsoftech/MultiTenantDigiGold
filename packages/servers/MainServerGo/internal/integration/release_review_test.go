//go:build integration

package integration

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"sync"
	"testing"
	"time"

	"github.com/pquerna/otp/totp"
	"golang.org/x/crypto/bcrypt"

	"github.com/rpsoftech/DigiGold/MainServerGo/interfaces"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/database"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/models"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/repository"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/service"
)

// Suspending the platform tenant would refuse every platform admin, including the one who
// could reactivate it, so it is refused.
func TestPlatformTenantCannotBeSuspended(t *testing.T) {
	t.Cleanup(func() {
		// Only needed if the guard is broken: put the platform back for the other tests.
		_, _ = db.Exec(`UPDATE tenants SET tenant_is_active = TRUE WHERE tenant_uuid = $1`, database.SeedPlatformTenantUUID)
		repository.GetTenantRepository().InvalidateTenantCaches(context.Background(), &models.Tenant{UUID: database.SeedPlatformTenantUUID})
	})

	expectError(t, tenantCall(t, "PATCH", "/"+database.SeedPlatformTenantUUID+"/status", map[string]any{"is_active": false}),
		http.StatusBadRequest, "CANNOT_SUSPEND_PLATFORM_TENANT")
	expectStatus(t, tenantCall(t, "GET", "/", nil), http.StatusOK)
}

// newEnrolledAdmin adds a demo-store manager whose TOTP is already enabled (with the seeded
// secret) and returns its UUID.
func newEnrolledAdmin(t *testing.T, username, phone string) string {
	t.Helper()
	hash, err := bcrypt.GenerateFromPassword([]byte(adminPassword), bcrypt.DefaultCost)
	if err != nil {
		t.Fatal(err)
	}
	var adminUUID string
	err = db.QueryRow(`
		INSERT INTO tenant_user_logins (
			tu_tenant_id, tu_username, tu_phone_number, tu_password_hash,
			tu_totp_secret, tu_is_totp_enabled, tu_role
		)
		SELECT tenant_id, $1, $2, $3, $4, TRUE, 'manager'
		FROM tenants WHERE tenant_uuid = $5
		RETURNING tu_uuid::text`, username, phone, string(hash), adminTOTPSecret, database.SeedDemoTenantUUID).Scan(&adminUUID)
	if err != nil {
		t.Fatal(err)
	}
	return adminUUID
}

func demoTenantID(t *testing.T) int64 {
	t.Helper()
	var id int64
	if err := db.QueryRow(`SELECT tenant_id FROM tenants WHERE tenant_uuid = $1`, database.SeedDemoTenantUUID).Scan(&id); err != nil {
		t.Fatal(err)
	}
	return id
}

// passwordStep runs the admin password step through the service (the HTTP auth routes allow
// only 10 requests a minute) and returns the temp token.
func passwordStep(t *testing.T, username string) string {
	t.Helper()
	tempToken, _, err := service.InitAdminAuthService().AdminLogin(context.Background(), demoTenantID(t), username, adminPassword)
	if err != nil {
		t.Fatalf("password step: %v", err)
	}
	return tempToken
}

func requestErrorName(err error) string {
	var reqErr *interfaces.RequestError
	if errors.As(err, &reqErr) {
		return reqErr.Name
	}
	return fmt.Sprint(err)
}

// A TOTP reset (lost or stolen device) must end the admin's sessions: their refresh token
// stops working, so they sign in with their password and enrol again.
func TestAdminTOTPResetEndsTheirSessions(t *testing.T) {
	adminUUID := newEnrolledAdmin(t, "totp-reset-staff", "9000000110")
	auth := service.InitAdminAuthService()
	ctx := context.Background()

	code, err := totp.GenerateCode(adminTOTPSecret, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	_, refreshToken, err := auth.VerifyTOTP(ctx, passwordStep(t, "totp-reset-staff"), code, "127.0.0.1")
	if err != nil {
		t.Fatalf("sign in: %v", err)
	}
	if _, refreshToken, err = auth.RefreshAdminTokens(ctx, refreshToken); err != nil {
		t.Fatalf("refresh before the reset: %v", err)
	}

	expectStatus(t, call(t, "PATCH", "/admin/admins/"+adminUUID, demoManager(t), database.SeedDemoTenantUUID,
		map[string]any{"reset_totp": true}), http.StatusOK)

	_, _, err = auth.RefreshAdminTokens(ctx, refreshToken)
	if name := requestErrorName(err); name != "ADMIN_REFRESH_TOKEN_INVALID" {
		t.Fatalf("refresh after the TOTP reset = %s, want ADMIN_REFRESH_TOKEN_INVALID", name)
	}
}

// Parallel wrong codes must not get more than maxTOTPAttempts checks per temp token: each
// attempt is counted before its code is checked. The token is then burned.
func TestAdminParallelTOTPGuessesAreCapped(t *testing.T) {
	newEnrolledAdmin(t, "totp-guess-staff", "9000000111")
	tempToken := passwordStep(t, "totp-guess-staff")
	auth := service.InitAdminAuthService()

	valid := map[string]bool{}
	for _, at := range []time.Time{time.Now().Add(-30 * time.Second), time.Now(), time.Now().Add(30 * time.Second)} {
		code, err := totp.GenerateCode(adminTOTPSecret, at)
		if err != nil {
			t.Fatal(err)
		}
		valid[code] = true
	}
	var guesses []string
	for i := 100000; len(guesses) < 20; i++ {
		if code := fmt.Sprint(i); !valid[code] {
			guesses = append(guesses, code)
		}
	}

	var mu sync.Mutex
	results := map[string]int{}
	var wg sync.WaitGroup
	for _, guess := range guesses {
		wg.Add(1)
		go func(code string) {
			defer wg.Done()
			_, _, err := auth.VerifyTOTP(context.Background(), tempToken, code, "127.0.0.1")
			mu.Lock()
			results[requestErrorName(err)]++
			mu.Unlock()
		}(guess)
	}
	wg.Wait()

	if checked := results["ADMIN_TOTP_CODE_INVALID"]; checked > 5 {
		t.Fatalf("%d of %d parallel guesses were checked, want at most 5 (results %v)", checked, len(guesses), results)
	}
	code, err := totp.GenerateCode(adminTOTPSecret, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	_, _, err = auth.VerifyTOTP(context.Background(), tempToken, code, "127.0.0.1")
	if name := requestErrorName(err); name != "ADMIN_TEMP_TOKEN_INVALID" {
		t.Fatalf("the right code after the cap = %s, want ADMIN_TEMP_TOKEN_INVALID (token burned)", name)
	}
}

// The portfolio is read through the user cache: a buy must not leave the old balance there.
func TestPortfolioShowsTheBalanceRightAfterABuy(t *testing.T) {
	setLiveRate(t, 7000, 6950)
	portfolio := func() float64 {
		r := call(t, "GET", "/user/portfolio", verifiedCustomer(t), database.SeedDemoTenantUUID, nil)
		expectStatus(t, r, http.StatusOK)
		return num(r.Body["balance_grams"])
	}

	portfolio() // caches the customer
	counterBuy(t, database.SeedVerifiedCustomerUUID, 1)
	expectGrams(t, "portfolio balance after the buy", portfolio(), balance(t, database.SeedVerifiedCustomerUUID))
}

// Registering twice (a double-submitted form) is a conflict, not a server error.
func TestRegisterTwiceIsAConflict(t *testing.T) {
	const phone = "9000000112"
	expectStatus(t, register(t, phone, "Asha Rao", "Pune"), http.StatusOK)
	expectError(t, register(t, phone, "Asha Rao", "Pune"), http.StatusConflict, "ALREADY_EXISTS")
}

// A margin update may say FLAT (the old name for FIXED_INR) and leave out the commodity;
// an unknown margin type is the client's mistake, not a 500.
func TestMarginUpdateNormalisesTheType(t *testing.T) {
	tenantUUID := onboardStore(t, "margin-store", "margin-root", "9000000113")
	margins := func(body map[string]any) response {
		return tenantCall(t, "PATCH", "/"+tenantUUID+"/margins", body)
	}

	expectStatus(t, margins(map[string]any{
		"sell_margin_type": "FLAT", "sell_margin_value": 50, "is_gst_enabled": true,
		"gst_percentage": 3, "tenant_credit_limit_grams": 100,
	}), http.StatusOK)
	list := tenantCall(t, "GET", "/"+tenantUUID+"/margins", nil)
	expectStatus(t, list, http.StatusOK)
	rows, _ := list.Body["data"].([]any)
	if len(rows) != 1 {
		t.Fatalf("margins = %v, want one row", list.Body)
	}
	row := rows[0].(map[string]any)
	if str(row["sell_margin_type"]) != "FIXED_INR" || str(row["commodity_type"]) != "GOLD" || num(row["sell_margin_value"]) != 50 {
		t.Fatalf("margin = %v, want FIXED_INR 50 on GOLD", row)
	}

	expectError(t, margins(map[string]any{"sell_margin_type": "BOGUS"}), http.StatusBadRequest, "INVALID_INPUT")
}

// A malformed UUID in the path is the client's mistake, not a 500 (which also alerts).
func TestMalformedUUIDInThePathIsABadRequest(t *testing.T) {
	expectError(t, call(t, "POST", "/trade/redemptions/not-a-uuid/cancel", verifiedCustomer(t), database.SeedDemoTenantUUID, nil),
		http.StatusBadRequest, "INVALID_INPUT")
}

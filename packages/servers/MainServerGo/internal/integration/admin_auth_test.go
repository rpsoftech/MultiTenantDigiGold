//go:build integration

package integration

import (
	"net/http"
	"sync"
	"testing"
	"time"

	"github.com/pquerna/otp"
	"github.com/pquerna/otp/totp"
	"golang.org/x/crypto/bcrypt"

	"github.com/rpsoftech/DigiGold/MainServerGo/internal/database"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/service"
)

func TestAdminFirstLoginEnrollmentPersistsEventAndIssuesTokens(t *testing.T) {
	const username = "totp-enrollment-manager"
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
		SELECT tenant_id, $1, '9000000042', $2, '', FALSE, 'manager'
		FROM tenants WHERE tenant_uuid = $3
		RETURNING tu_uuid`, username, string(hash), database.SeedDemoTenantUUID).Scan(&adminUUID)
	if err != nil {
		t.Fatal(err)
	}

	login := call(t, "POST", "/admin/auth/login", "", database.SeedDemoTenantUUID, map[string]string{
		"username": username, "password": adminPassword,
	})
	expectStatus(t, login, http.StatusOK)
	tempToken := str(login.Body["temp_token"])
	if tempToken == "" || login.Body["access_token"] != nil {
		t.Fatal("password login must return a temporary token without authenticating")
	}
	if enabled, ok := login.Body["totp_enabled"].(bool); !ok || enabled {
		t.Fatalf("a first login must report totp_enabled=false so the QR code is shown; got %v", login.Body["totp_enabled"])
	}
	setup := call(t, "POST", "/admin/auth/totp/setup", "", database.SeedDemoTenantUUID, map[string]string{
		"temp_token": tempToken,
	})
	expectStatus(t, setup, http.StatusOK)
	key, err := otp.NewKeyFromURL(str(setup.Body["otpauth_uri"]))
	if err != nil {
		t.Fatalf("parse enrollment URI: %v", err)
	}
	code, err := totp.GenerateCode(key.Secret(), time.Now())
	if err != nil {
		t.Fatal(err)
	}
	verify := call(t, "POST", "/admin/auth/totp/verify", "", database.SeedDemoTenantUUID, map[string]string{
		"temp_token": tempToken, "code": code,
	})
	expectStatus(t, verify, http.StatusOK)
	accessToken := str(verify.Body["access_token"])
	refreshToken := str(verify.Body["refresh_token"])
	claims, err := service.GetJWTService().ValidateAdminToken(accessToken)
	if err != nil || claims.AdminUUID != adminUUID || claims.Role != "manager" || claims.Username != username {
		t.Fatalf("invalid final admin access token (or missing username): %v", err)
	}
	if _, err := service.GetJWTService().ValidateAdminRefreshToken(refreshToken); err != nil {
		t.Fatalf("invalid final admin refresh token: %v", err)
	}

	var enabled bool
	if err := db.QueryRow(`SELECT tu_is_totp_enabled FROM tenant_user_logins WHERE tu_uuid = $1`, adminUUID).Scan(&enabled); err != nil {
		t.Fatal(err)
	}
	if !enabled {
		t.Fatal("successful verification must commit authenticator enrollment")
	}
	var role, eventIP, payloadIP string
	err = db.QueryRow(`
		SELECT payload->>'role', COALESCE(ip_address_occurred_from, ''), payload->>'ip'
		FROM system_events WHERE event_name = 'ADMIN_LOGGED_IN' AND admin_id = $1`,
		adminUUID).Scan(&role, &eventIP, &payloadIP)
	if err != nil {
		t.Fatalf("login audit event was not persisted: %v", err)
	}
	if role != "manager" || payloadIP != eventIP {
		t.Fatalf("login audit payload role/IP = %q/%q, event IP = %q", role, payloadIP, eventIP)
	}

	replay := call(t, "POST", "/admin/auth/totp/verify", "", database.SeedDemoTenantUUID, map[string]string{
		"temp_token": tempToken, "code": code,
	})
	expectError(t, replay, http.StatusUnauthorized, "ADMIN_TEMP_TOKEN_INVALID")
	refresh := call(t, "POST", "/admin/auth/refresh", "", database.SeedDemoTenantUUID, map[string]string{
		"refresh_token": refreshToken,
	})
	expectStatus(t, refresh, http.StatusOK)
	if refreshed, err := service.GetJWTService().ValidateAdminToken(str(refresh.Body["access_token"])); err != nil || refreshed.Username != username {
		t.Fatalf("refreshed admin access token rejected (or missing username): %v", err)
	}
	rotatedRefresh := str(refresh.Body["refresh_token"])
	if _, err := service.GetJWTService().ValidateAdminRefreshToken(rotatedRefresh); err != nil {
		t.Fatalf("refreshed admin refresh token rejected: %v", err)
	}

	// Refresh tokens are single use: the one just exchanged must not work again.
	reused := call(t, "POST", "/admin/auth/refresh", "", database.SeedDemoTenantUUID, map[string]string{
		"refresh_token": refreshToken,
	})
	expectError(t, reused, http.StatusUnauthorized, "ADMIN_REFRESH_TOKEN_INVALID")

	// Logout revokes the current refresh token server-side.
	logout := call(t, "POST", "/admin/auth/logout", "", database.SeedDemoTenantUUID, map[string]string{
		"refresh_token": rotatedRefresh,
	})
	expectStatus(t, logout, http.StatusOK)
	afterLogout := call(t, "POST", "/admin/auth/refresh", "", database.SeedDemoTenantUUID, map[string]string{
		"refresh_token": rotatedRefresh,
	})
	expectError(t, afterLogout, http.StatusUnauthorized, "ADMIN_REFRESH_TOKEN_INVALID")

	// A malformed refresh token is a client error with a stable name, not leaked internals.
	garbage := call(t, "POST", "/admin/auth/refresh", "", database.SeedDemoTenantUUID, map[string]string{
		"refresh_token": "not-a-jwt",
	})
	expectError(t, garbage, http.StatusUnauthorized, "ADMIN_REFRESH_TOKEN_INVALID")
}

func TestAdminPendingEnrollmentSurvivesSetupRetriesAndPasswordLogins(t *testing.T) {
	const username = "pending-enrollment-manager"
	createPendingEnrollmentAdmin(t, username, "9000000043")
	firstToken := passwordChallenge(t, username)
	firstSetup := setupEnrollment(t, firstToken)
	firstURI := str(firstSetup.Body["otpauth_uri"])

	retry := setupEnrollment(t, firstToken)
	if str(retry.Body["otpauth_uri"]) != firstURI {
		t.Fatal("retrying setup replaced the QR code's enrollment secret")
	}
	secondToken := passwordChallenge(t, username)
	secondSetup := setupEnrollment(t, secondToken)
	if str(secondSetup.Body["otpauth_uri"]) != firstURI {
		t.Fatal("a new password login replaced the pending enrollment secret")
	}
	key, err := otp.NewKeyFromURL(firstURI)
	if err != nil {
		t.Fatal("enrollment URI was invalid")
	}
	if key.Issuer() != "DigiGold-Admin" || key.AccountName() != username ||
		key.Period() != 30 || key.Digits() != otp.DigitsSix || key.Algorithm() != otp.AlgorithmSHA1 {
		t.Fatal("enrollment URI settings must match the TOTP verifier")
	}
	code, err := totp.GenerateCode(key.Secret(), time.Now())
	if err != nil {
		t.Fatal(err)
	}
	verify := call(t, "POST", "/admin/auth/totp/verify", "", database.SeedDemoTenantUUID, map[string]string{
		"temp_token": firstToken, "code": code,
	})
	expectStatus(t, verify, http.StatusOK)
	if str(verify.Body["access_token"]) == "" || str(verify.Body["refresh_token"]) == "" {
		t.Fatal("a code from the first QR must complete enrollment and issue both tokens")
	}
	alreadyEnabled := call(t, "POST", "/admin/auth/totp/setup", "", database.SeedDemoTenantUUID, map[string]string{
		"temp_token": secondToken,
	})
	// Enrolled admins must be directed to verification without a replacement QR; the
	// frontend keys off this stable name, never the message text.
	expectError(t, alreadyEnabled, http.StatusConflict, "ADMIN_TOTP_ALREADY_ENABLED")

	// A code is accepted once (RFC 6238 §5.2): replaying it with another password login is
	// refused while the code would still validate.
	reused := call(t, "POST", "/admin/auth/totp/verify", "", database.SeedDemoTenantUUID, map[string]string{
		"temp_token": secondToken, "code": code,
	})
	expectError(t, reused, http.StatusUnauthorized, "ADMIN_TOTP_CODE_USED")

	// Once enrolled, the password step says so, letting the client skip setup.
	login := call(t, "POST", "/admin/auth/login", "", database.SeedDemoTenantUUID, map[string]string{
		"username": username, "password": adminPassword,
	})
	expectStatus(t, login, http.StatusOK)
	if enabled, ok := login.Body["totp_enabled"].(bool); !ok || !enabled {
		t.Fatalf("an enrolled admin's login must report totp_enabled=true; got %v", login.Body["totp_enabled"])
	}
}

func TestAdminConcurrentSetupUsesOneEnrollmentSecret(t *testing.T) {
	const username = "concurrent-enrollment-manager"
	createPendingEnrollmentAdmin(t, username, "9000000044")
	firstToken := passwordChallenge(t, username)
	secondToken := passwordChallenge(t, username)
	tokens := []string{firstToken, secondToken}
	responses := make([]response, len(tokens))
	start := make(chan struct{})
	var workers sync.WaitGroup
	for index, token := range tokens {
		workers.Add(1)
		go func(index int, token string) {
			defer workers.Done()
			<-start
			responses[index] = call(t, "POST", "/admin/auth/totp/setup", "", database.SeedDemoTenantUUID, map[string]string{
				"temp_token": token,
			})
		}(index, token)
	}
	close(start)
	workers.Wait()
	for _, result := range responses {
		expectStatus(t, result, http.StatusOK)
	}
	if str(responses[0].Body["otpauth_uri"]) != str(responses[1].Body["otpauth_uri"]) {
		t.Fatal("simultaneous setup requests returned different enrollment secrets")
	}
	key, err := otp.NewKeyFromURL(str(responses[0].Body["otpauth_uri"]))
	if err != nil {
		t.Fatal("enrollment URI was invalid")
	}

	// Two simultaneous verifies of one password login, each with a different valid code
	// (current step and the previous one, within the allowed clock skew): the temp token
	// is consumed atomically, so exactly one gets a session.
	now := time.Now()
	codes := make([]string, 2)
	for index, at := range []time.Time{now, now.Add(-30 * time.Second)} {
		if codes[index], err = totp.GenerateCode(key.Secret(), at); err != nil {
			t.Fatal(err)
		}
	}
	if codes[0] == codes[1] {
		t.Skip("consecutive TOTP codes collided; nothing to race")
	}
	verifies := make([]response, len(codes))
	start = make(chan struct{})
	for index, code := range codes {
		workers.Add(1)
		go func(index int, code string) {
			defer workers.Done()
			<-start
			verifies[index] = call(t, "POST", "/admin/auth/totp/verify", "", database.SeedDemoTenantUUID, map[string]string{
				"temp_token": firstToken, "code": code,
			})
		}(index, code)
	}
	close(start)
	workers.Wait()
	succeeded := 0
	for _, result := range verifies {
		if result.Status == http.StatusOK {
			succeeded++
			continue
		}
		expectError(t, result, http.StatusUnauthorized, "ADMIN_TEMP_TOKEN_INVALID")
	}
	if succeeded != 1 {
		t.Fatalf("%d concurrent verifies of one temp token succeeded, want exactly 1", succeeded)
	}
}

func createPendingEnrollmentAdmin(t *testing.T, username, phone string) {
	t.Helper()
	hash, err := bcrypt.GenerateFromPassword([]byte(adminPassword), bcrypt.DefaultCost)
	if err != nil {
		t.Fatal(err)
	}
	// Real newly provisioned admins may have NULL secrets rather than empty strings.
	_, err = db.Exec(`
		INSERT INTO tenant_user_logins (
			tu_tenant_id, tu_username, tu_phone_number, tu_password_hash,
			tu_totp_secret, tu_is_totp_enabled, tu_role
		)
		SELECT tenant_id, $1, $2, $3, NULL, FALSE, 'manager'
		FROM tenants WHERE tenant_uuid = $4`, username, phone, string(hash), database.SeedDemoTenantUUID)
	if err != nil {
		t.Fatal(err)
	}
}

func passwordChallenge(t *testing.T, username string) string {
	t.Helper()
	login := call(t, "POST", "/admin/auth/login", "", database.SeedDemoTenantUUID, map[string]string{
		"username": username, "password": adminPassword,
	})
	expectStatus(t, login, http.StatusOK)
	if token := str(login.Body["temp_token"]); token != "" {
		return token
	}
	t.Fatal("password login did not return a temporary token")
	return ""
}

func setupEnrollment(t *testing.T, token string) response {
	t.Helper()
	setup := call(t, "POST", "/admin/auth/totp/setup", "", database.SeedDemoTenantUUID, map[string]string{
		"temp_token": token,
	})
	expectStatus(t, setup, http.StatusOK)
	return setup
}

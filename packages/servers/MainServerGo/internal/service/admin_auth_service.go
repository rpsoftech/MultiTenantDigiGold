package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"sync"
	"time"

	"github.com/pquerna/otp"
	"github.com/pquerna/otp/totp"
	"github.com/redis/go-redis/v9"
	"github.com/rpsoftech/DigiGold/MainServerGo/events"
	"github.com/rpsoftech/DigiGold/MainServerGo/interfaces"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/models"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/repository"
	utility_functions "github.com/rpsoftech/DigiGold/MainServerGo/utility/functions"
	"github.com/rpsoftech/DigiGold/MainServerGo/utility/postgres"
	redis_client "github.com/rpsoftech/DigiGold/MainServerGo/utility/redis"
	"golang.org/x/crypto/bcrypt"
)

type AdminAuthService struct {
	DB        *postgres.PostgresDBStruct
	Redis     *redis_client.RedisClientStruct
	AdminRepo *repository.TenantUserLoginRepository
	EventRepo *repository.EventRepository
}

var (
	adminAuthServiceInstance *AdminAuthService
	adminAuthServiceOnce     sync.Once
)

func InitAdminAuthService() *AdminAuthService {
	adminAuthServiceOnce.Do(func() {
		adminAuthServiceInstance = &AdminAuthService{
			DB:        postgres.GetPostgresDB(),
			Redis:     redis_client.InitRedisClient(),
			AdminRepo: repository.GetTenantUserLoginRepository(),
			EventRepo: repository.GetEventRepository(),
		}
	})
	return adminAuthServiceInstance
}

// maxTOTPAttempts is the number of wrong TOTP codes allowed per login temp token.
const maxTOTPAttempts = 5

// Client-facing admin auth failures. Each has a stable Name the frontend switches on (never
// the message text), and goes through GlobalErrorHandler like every other API error. Any
// error NOT listed here is a server fault: it becomes a generic 500 and is reported to
// monitoring, instead of being shown to the admin as "invalid code" with internal details.
func adminAuthError(status, code int, name, message string) *interfaces.RequestError {
	return &interfaces.RequestError{StatusCode: status, Code: code, Name: name, Message: message}
}

var (
	errAdminTempTokenInvalid = adminAuthError(http.StatusUnauthorized, interfaces.ERROR_INVALID_TOKEN,
		"ADMIN_TEMP_TOKEN_INVALID", "Your sign-in has expired. Please enter your password again.")
	errAdminTOTPCodeInvalid = adminAuthError(http.StatusUnauthorized, interfaces.ERROR_OTP_INVALID,
		"ADMIN_TOTP_CODE_INVALID", "That code is incorrect or has expired.")
	errAdminTOTPCodeUsed = adminAuthError(http.StatusUnauthorized, interfaces.ERROR_OTP_INVALID,
		"ADMIN_TOTP_CODE_USED", "That code was already used. Wait for the next code in your authenticator app.")
	errAdminTOTPNotSetUp = adminAuthError(http.StatusBadRequest, interfaces.ERROR_INVALID_INPUT,
		"ADMIN_TOTP_NOT_SET_UP", "Set up your authenticator app before entering a code.")
	errAdminTOTPAlreadyEnabled = adminAuthError(http.StatusConflict, interfaces.ERROR_INVALID_INPUT,
		"ADMIN_TOTP_ALREADY_ENABLED", "TOTP is already enabled for this admin")
	errAdminRefreshTokenInvalid = adminAuthError(http.StatusUnauthorized, interfaces.ERROR_INVALID_TOKEN,
		"ADMIN_REFRESH_TOKEN_INVALID", "Your admin session has expired. Please sign in again.")
	errAdminDeactivated = adminAuthError(http.StatusForbidden, interfaces.ERROR_PERMISSION_NOT_ALLOWED,
		"ADMIN_DEACTIVATED", "This admin account has been deactivated.")
)

// isServerFault reports whether err is an unexpected failure (Redis, database, signing)
// rather than one of the client-facing RequestErrors above.
func isServerFault(err error) bool {
	var requestErr *interfaces.RequestError
	return err != nil && !errors.As(err, &requestErr)
}

// adminRefreshKey is the server-side record of one live admin refresh token (by jti).
func adminRefreshKey(refreshID string) string {
	return "auth:admin_refresh:" + refreshID
}

// adminTempTokenKey holds the password-step result a TOTP setup/verify must present.
func adminTempTokenKey(tempToken string) string {
	return "auth:temp_token:" + tempToken
}

// adminTOTPUsedKey marks a TOTP code as spent for one admin. A code validates for its whole
// 30 s step plus one step of clock skew either side, so the mark outlives that window.
func adminTOTPUsedKey(adminUUID, code string) string {
	return "auth:admin_totp_used:" + adminUUID + ":" + code
}

const adminTOTPReuseWindow = 2 * time.Minute

// dummyPasswordHash is compared against when the admin does not exist (timing equalization).
var dummyPasswordHash, _ = bcrypt.GenerateFromPassword([]byte("digigold-timing-dummy"), bcrypt.DefaultCost)

type TempTokenPayload struct {
	TenantID int64  `json:"tenant_id"`
	AdminID  string `json:"admin_uuid"`
	Username string `json:"username"`
}

// 1. Login (Validates Password, returns Temp Token). totpEnabled tells the client whether to
// show the enrollment QR code (TOTP setup) or go straight to asking for a code. It is only
// revealed after the password has been accepted.
func (s *AdminAuthService) AdminLogin(ctx context.Context, tenantID int64, username, password string) (tempToken string, totpEnabled bool, err error) {

	// Same response for unknown user and wrong password, so usernames cannot be enumerated.
	invalidCredentials := &interfaces.RequestError{
		StatusCode: http.StatusUnauthorized,
		Code:       interfaces.ERROR_INVALID_PASSWORD,
		Name:       "InvalidCredentials",
		Message:    "Invalid credentials",
	}

	admin, err := s.AdminRepo.GetActiveAdminByUsername(ctx, tenantID, username)
	if err != nil {
		// Burn comparable time to a real check so response timing does not reveal the user.
		_ = bcrypt.CompareHashAndPassword(dummyPasswordHash, []byte(password))
		return "", false, invalidCredentials
	}

	if err := bcrypt.CompareHashAndPassword([]byte(admin.PasswordHash), []byte(password)); err != nil {
		return "", false, invalidCredentials
	}

	// Generate Temp Token
	tempToken = utility_functions.GenerateNewUUID()
	payload := TempTokenPayload{
		TenantID: admin.TenantID,
		AdminID:  admin.UUID,
		Username: admin.Username,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return "", false, &interfaces.RequestError{
			StatusCode: http.StatusInternalServerError,
			Code:       interfaces.ERROR_INTERNAL_SERVER,
			Name:       "TempTokenGenerationFailed",
			Message:    "Failed to generate temporary token",
			Extra:      err.Error(),
		}
	}

	// Store Temp Token in Redis for 5 minutes
	err = s.Redis.SetStringDataWithExpiry(ctx, adminTempTokenKey(tempToken), string(jsonData), 5*time.Minute)
	if err != nil {
		return "", false, &interfaces.RequestError{
			StatusCode: http.StatusInternalServerError,
			Code:       interfaces.ERROR_INTERNAL_SERVER,
			Name:       "TempTokenStorageFailed",
			Message:    "Failed to store temporary token",
			Extra:      err.Error(),
		}
	}

	return tempToken, admin.IsTOTPEnabled, nil
}

// 2. Setup TOTP (Returns otpauth URI)
func (s *AdminAuthService) SetupTOTP(ctx context.Context, tempToken string) (string, string, error) {
	payload, err := s.verifyTempToken(ctx, tempToken)
	if err != nil {
		return "", "", err
	}

	admin, err := s.AdminRepo.GetFullAdminByUUID(ctx, payload.TenantID, payload.AdminID)
	if errors.Is(err, interfaces.ErrUserNotFound) {
		return "", "", errAdminTempTokenInvalid
	}
	if err != nil {
		return "", "", err
	}

	if admin.IsTOTPEnabled {
		return "", "", errAdminTOTPAlreadyEnabled
	}
	if !admin.IsActive {
		return "", "", errAdminDeactivated
	}

	// Reuse an unfinished enrollment. Retrying setup must never invalidate a
	// QR code the admin has already added to their authenticator.
	candidateSecret := admin.TOTPSecret
	if candidateSecret == "" {
		key, err := totp.Generate(totp.GenerateOpts{
			Issuer:      "DigiGold-Admin",
			AccountName: admin.Username,
			Period:      30,
			Digits:      otp.DigitsSix,
			Algorithm:   otp.AlgorithmSHA1,
		})
		if err != nil {
			return "", "", fmt.Errorf("failed to generate TOTP secret: %w", err)
		}
		candidateSecret = key.Secret()
	}

	// The repository returns the stored secret, including the winner of a
	// concurrent setup from another login or browser tab.
	secret, err := s.AdminRepo.InitializeTOTPSecret(ctx, payload.TenantID, payload.AdminID, candidateSecret)
	if errors.Is(err, repository.ErrTOTPAlreadyEnabled) {
		return "", "", errAdminTOTPAlreadyEnabled
	}
	if errors.Is(err, interfaces.ErrUserNotFound) {
		return "", "", errAdminTempTokenInvalid
	}
	if err != nil {
		return "", "", fmt.Errorf("failed to save TOTP secret: %w", err)
	}

	return secret, adminTOTPEnrollmentURI(admin.Username, secret), nil
}

func adminTOTPEnrollmentURI(username, secret string) string {
	values := url.Values{
		"secret":    {secret},
		"issuer":    {"DigiGold-Admin"},
		"algorithm": {otp.AlgorithmSHA1.String()},
		"digits":    {otp.DigitsSix.String()},
		"period":    {"30"},
	}
	uri := url.URL{
		Scheme:   "otpauth",
		Host:     "totp",
		Path:     "/DigiGold-Admin:" + username,
		RawQuery: values.Encode(),
	}
	return uri.String()
}

// 3. Verify TOTP (Validates code, issues final JWTs)
func (s *AdminAuthService) VerifyTOTP(ctx context.Context, tempToken, code, ip string) (accessToken, refreshToken string, err error) {
	payload, err := s.verifyTempToken(ctx, tempToken)
	if err != nil {
		return "", "", err
	}

	admin, err := s.AdminRepo.GetFullAdminByUUID(ctx, payload.TenantID, payload.AdminID)
	if errors.Is(err, interfaces.ErrUserNotFound) {
		return "", "", errAdminTempTokenInvalid
	}
	if err != nil {
		return "", "", err
	}
	if !admin.IsActive {
		return "", "", errAdminDeactivated
	}

	if admin.TOTPSecret == "" {
		return "", "", errAdminTOTPNotSetUp
	}

	// Validate TOTP Code
	valid := totp.Validate(code, admin.TOTPSecret)
	if !valid {
		// Cap guesses per temp token; after maxTOTPAttempts the password step must be repeated.
		attemptsKey := fmt.Sprintf("auth:temp_token_attempts:%s", tempToken)
		attempts, _ := s.Redis.Client.Incr(ctx, attemptsKey).Result()
		s.Redis.Client.Expire(ctx, attemptsKey, 5*time.Minute)
		if attempts >= maxTOTPAttempts {
			_ = s.Redis.RemoveKey(ctx, adminTempTokenKey(tempToken))
			s.Redis.Client.Del(ctx, attemptsKey)
		}
		return "", "", errAdminTOTPCodeInvalid
	}

	// RFC 6238 §5.2: accept each code once. Without this, a code seen over the admin's
	// shoulder (plus the password) opens a second session while the code is still valid.
	usedKey := s.Redis.GetRedisKey(adminTOTPUsedKey(admin.UUID, code))
	claimed, err := s.Redis.Client.SetNX(ctx, usedKey, "1", adminTOTPReuseWindow).Result()
	if err != nil {
		return "", "", fmt.Errorf("failed to record used TOTP code: %w", err)
	}
	if !claimed {
		return "", "", errAdminTOTPCodeUsed
	}

	// Consume the temp token atomically, so two concurrent verifies of one password login
	// can't both get a session.
	tempKey := s.Redis.GetRedisKey(adminTempTokenKey(tempToken))
	tempTTL := s.Redis.Client.PTTL(ctx, tempKey).Val()
	tempData, err := s.Redis.Client.GetDel(ctx, tempKey).Result()
	if err != nil {
		s.Redis.Client.Del(context.Background(), usedKey)
		if errors.Is(err, redis.Nil) {
			return "", "", errAdminTempTokenInvalid
		}
		return "", "", fmt.Errorf("failed to consume admin temp token: %w", err)
	}

	// From here on every failure is a server fault, and it must not cost the admin their
	// sign-in: put the temp token back and release the code, so the same code can simply be
	// submitted again.
	defer func() {
		if err == nil {
			return
		}
		bg := context.Background()
		s.Redis.Client.Del(bg, usedKey)
		if tempTTL > 0 {
			s.Redis.Client.Set(bg, tempKey, tempData, tempTTL)
		}
	}()

	// Begin TX for event sourcing
	tx, err := s.DB.Db.BeginTx(ctx, nil)
	if err != nil {
		return "", "", fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	if !admin.IsTOTPEnabled {
		admin.IsTOTPEnabled = true
		err = s.AdminRepo.UpdateFullAdminWithTx(ctx, tx, admin)
		if err != nil {
			return "", "", fmt.Errorf("failed to update admin TOTP status: %w", err)
		}
	}

	// Generate System Event (ADMIN_LOGGED_IN)
	tenantIdStr := fmt.Sprintf("%d", admin.TenantID)
	loginEvent := events.GenerateAdminLoggedInEvent(tenantIdStr, admin.UUID, admin.Role, ip)
	err = s.EventRepo.SaveEventWithTx(ctx, tx, &loginEvent.BaseEvent)
	if err != nil {
		return "", "", fmt.Errorf("failed to save login event: %w", err)
	}

	// Issue the tokens before committing, so the event log never records a login whose
	// session failed to be created (e.g. Redis down). If the commit then fails, revoke them.
	accessToken, refreshToken, err = s.issueAdminTokens(ctx, admin)
	if err != nil {
		return "", "", err
	}

	if commitErr := tx.Commit(); commitErr != nil {
		_ = s.RevokeAdminRefreshToken(context.Background(), refreshToken)
		return "", "", fmt.Errorf("failed to commit transaction: %w", commitErr)
	}

	s.Redis.Client.Del(ctx, fmt.Sprintf("auth:temp_token_attempts:%s", tempToken))
	return accessToken, refreshToken, nil
}

// issueAdminTokens signs a token pair and records the refresh token server-side, so it can
// be used exactly once (RefreshAdminTokens) and revoked (RevokeAdminRefreshToken).
func (s *AdminAuthService) issueAdminTokens(ctx context.Context, admin *models.TenantUserLogin) (string, string, error) {
	accessToken, refreshToken, refreshID, err := GetJWTService().GenerateAdminTokenPair(admin.UUID, admin.Username, admin.Role, admin.TenantID)
	if err != nil {
		return "", "", fmt.Errorf("failed to generate admin tokens: %w", err)
	}
	if err := s.Redis.SetStringDataWithExpiry(ctx, adminRefreshKey(refreshID), admin.UUID, AdminRefreshTokenTTL); err != nil {
		return "", "", fmt.Errorf("failed to record admin refresh token: %w", err)
	}
	return accessToken, refreshToken, nil
}

// RefreshAdminTokens exchanges a refresh token for a new pair. Refresh tokens are single
// use: the old one's server-side record is consumed atomically (GETDEL), so a copied token
// stops working once either party uses it, and logout can revoke it. A refresh token
// without a record (already used, revoked, or issued before records existed) is rejected.
func (s *AdminAuthService) RefreshAdminTokens(ctx context.Context, refreshToken string) (accessToken, newRefreshToken string, err error) {
	claims, err := GetJWTService().ValidateAdminRefreshToken(refreshToken)
	if err != nil || claims.ID == "" {
		return "", "", errAdminRefreshTokenInvalid
	}

	key := adminRefreshKey(claims.ID)
	owner, err := s.Redis.Client.GetDel(ctx, s.Redis.GetRedisKey(key)).Result()
	if errors.Is(err, redis.Nil) || (err == nil && owner != claims.AdminUUID) {
		return "", "", errAdminRefreshTokenInvalid
	}
	if err != nil {
		return "", "", fmt.Errorf("failed to read admin refresh token record: %w", err)
	}

	// From here on a server fault must not cost the admin their session: put the consumed
	// record back so the same refresh token can be retried. Client errors (admin deleted or
	// deactivated) keep it consumed.
	defer func() {
		if !isServerFault(err) {
			return
		}
		if remaining := time.Until(claims.ExpiresAt.Time); remaining > 0 {
			_ = s.Redis.SetStringDataWithExpiry(context.Background(), key, owner, remaining)
		}
	}()

	admin, err := s.AdminRepo.GetFullAdminByUUID(ctx, claims.TenantID, claims.AdminUUID)
	if errors.Is(err, interfaces.ErrUserNotFound) {
		return "", "", errAdminRefreshTokenInvalid
	}
	if err != nil {
		return "", "", err
	}
	if !admin.IsActive {
		return "", "", errAdminDeactivated
	}

	return s.issueAdminTokens(ctx, admin)
}

// RevokeAdminRefreshToken ends the session a refresh token belongs to (admin logout). An
// invalid or already-revoked token is not an error: the outcome the caller wants holds.
func (s *AdminAuthService) RevokeAdminRefreshToken(ctx context.Context, refreshToken string) error {
	claims, err := GetJWTService().ValidateAdminRefreshToken(refreshToken)
	if err != nil || claims.ID == "" {
		return nil
	}
	if err := s.Redis.RemoveKey(ctx, adminRefreshKey(claims.ID)); err != nil {
		return fmt.Errorf("failed to revoke admin refresh token: %w", err)
	}
	return nil
}

func (s *AdminAuthService) verifyTempToken(ctx context.Context, tempToken string) (*TempTokenPayload, error) {
	jsonData, err := s.Redis.GetStringData(ctx, adminTempTokenKey(tempToken))
	if errors.Is(err, redis.Nil) || (err == nil && jsonData == "") {
		return nil, errAdminTempTokenInvalid
	}
	if err != nil {
		// Redis unavailable: a server fault, not an expired sign-in.
		return nil, fmt.Errorf("failed to read admin temp token: %w", err)
	}

	var payload TempTokenPayload
	if err := json.Unmarshal([]byte(jsonData), &payload); err != nil {
		return nil, errAdminTempTokenInvalid
	}
	return &payload, nil
}

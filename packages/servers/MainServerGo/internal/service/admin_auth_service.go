package service

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/pquerna/otp/totp"
	"github.com/rpsoftech/DigiGold/MainServerGo/events"
	"github.com/rpsoftech/DigiGold/MainServerGo/interfaces"
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

// dummyPasswordHash is compared against when the admin does not exist (timing equalization).
var dummyPasswordHash, _ = bcrypt.GenerateFromPassword([]byte("digigold-timing-dummy"), bcrypt.DefaultCost)

type TempTokenPayload struct {
	TenantID int64  `json:"tenant_id"`
	AdminID  string `json:"admin_uuid"`
	Username string `json:"username"`
}

// 1. Login (Validates Password, returns Temp Token)
func (s *AdminAuthService) AdminLogin(ctx context.Context, tenantID int64, username, password string) (string, error) {

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
		return "", invalidCredentials
	}

	if err := bcrypt.CompareHashAndPassword([]byte(admin.PasswordHash), []byte(password)); err != nil {
		return "", invalidCredentials
	}

	// Generate Temp Token
	tempToken := utility_functions.GenerateNewUUID()
	payload := TempTokenPayload{
		TenantID: admin.TenantID,
		AdminID:  admin.UUID,
		Username: admin.Username,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return "", &interfaces.RequestError{
			StatusCode: http.StatusInternalServerError,
			Code:       interfaces.ERROR_INTERNAL_SERVER,
			Name:       "TempTokenGenerationFailed",
			Message:    "Failed to generate temporary token",
			Extra:      err.Error(),
		}
	}

	// Store Temp Token in Redis for 5 minutes
	cacheKey := fmt.Sprintf("auth:temp_token:%s", tempToken)
	err = s.Redis.SetStringDataWithExpiry(ctx, cacheKey, string(jsonData), 5*time.Minute)
	if err != nil {
		return "", &interfaces.RequestError{
			StatusCode: http.StatusInternalServerError,
			Code:       interfaces.ERROR_INTERNAL_SERVER,
			Name:       "TempTokenStorageFailed",
			Message:    "Failed to store temporary token",
			Extra:      err.Error(),
		}
	}

	return tempToken, nil
}

// 2. Setup TOTP (Returns otpauth URI)
func (s *AdminAuthService) SetupTOTP(ctx context.Context, tempToken string) (string, string, error) {
	payload, err := s.verifyTempToken(ctx, tempToken)
	if err != nil {
		return "", "", err
	}

	admin, err := s.AdminRepo.GetFullAdminByUUID(ctx, payload.TenantID, payload.AdminID)
	if err != nil {
		return "", "", err
	}

	if admin.IsTOTPEnabled {
		return "", "", fmt.Errorf("TOTP is already enabled for this admin")
	}

	// Generate TOTP Secret
	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      "DigiGold-Admin",
		AccountName: admin.Username,
	})
	if err != nil {
		return "", "", fmt.Errorf("failed to generate TOTP secret: %w", err)
	}

	secret := key.Secret()
	uri := key.URL()

	// Temporarily store secret in Redis tied to the temp token, or just return it to frontend (and verify will accept it if valid)
	// Actually, wait, verify will need the secret. We should update the DB with the secret but NOT enable it until verified.

	admin.TOTPSecret = secret
	err = s.AdminRepo.UpdateFullAdmin(ctx, admin)
	if err != nil {
		return "", "", fmt.Errorf("failed to save TOTP secret: %w", err)
	}

	return secret, uri, nil
}

// 3. Verify TOTP (Validates code, issues final JWTs)
func (s *AdminAuthService) VerifyTOTP(ctx context.Context, tempToken, code, ip string) (string, string, error) {
	payload, err := s.verifyTempToken(ctx, tempToken)
	if err != nil {
		return "", "", err
	}

	admin, err := s.AdminRepo.GetFullAdminByUUID(ctx, payload.TenantID, payload.AdminID)
	if err != nil {
		return "", "", err
	}

	if admin.TOTPSecret == "" {
		return "", "", fmt.Errorf("TOTP secret not found, please call setup first")
	}

	// Validate TOTP Code
	valid := totp.Validate(code, admin.TOTPSecret)
	if !valid {
		// Cap guesses per temp token; after maxTOTPAttempts the password step must be repeated.
		attemptsKey := fmt.Sprintf("auth:temp_token_attempts:%s", tempToken)
		attempts, _ := s.Redis.Client.Incr(ctx, attemptsKey).Result()
		s.Redis.Client.Expire(ctx, attemptsKey, 5*time.Minute)
		if attempts >= maxTOTPAttempts {
			_ = s.Redis.RemoveKey(ctx, fmt.Sprintf("auth:temp_token:%s", tempToken))
			s.Redis.Client.Del(ctx, attemptsKey)
		}
		return "", "", fmt.Errorf("invalid TOTP code")
	}

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

	err = tx.Commit()
	if err != nil {
		return "", "", fmt.Errorf("failed to commit transaction: %w", err)
	}

	// Issue final JWTs
	accessToken, refreshToken, err := GetJWTService().GenerateAdminTokens(admin.UUID, admin.Role, admin.TenantID)
	if err != nil {
		return "", "", fmt.Errorf("failed to generate access token: %w", err)
	}

	// Invalidate Temp Token
	cacheKey := fmt.Sprintf("auth:temp_token:%s", tempToken)
	_ = s.Redis.RemoveKey(context.Background(), cacheKey)

	return accessToken, refreshToken, nil
}

func (s *AdminAuthService) RefreshAdminTokens(ctx context.Context, refreshToken string) (string, string, error) {
	claims, err := GetJWTService().ValidateAdminRefreshToken(refreshToken)
	if err != nil {
		return "", "", err
	}

	admin, err := s.AdminRepo.GetFullAdminByUUID(ctx, claims.TenantID, claims.AdminUUID)
	if err != nil {
		return "", "", err
	}

	if !admin.IsActive {
		return "", "", fmt.Errorf("admin user is deactivated")
	}

	newAccessToken, newRefreshToken, err := GetJWTService().GenerateAdminTokens(admin.UUID, admin.Role, admin.TenantID)
	if err != nil {
		return "", "", fmt.Errorf("failed to generate access tokens: %w", err)
	}

	return newAccessToken, newRefreshToken, nil
}

func (s *AdminAuthService) verifyTempToken(ctx context.Context, tempToken string) (*TempTokenPayload, error) {
	cacheKey := fmt.Sprintf("auth:temp_token:%s", tempToken)
	jsonData, err := s.Redis.GetStringData(ctx, cacheKey)
	if err != nil || jsonData == "" {
		return nil, fmt.Errorf("invalid or expired temporary token")
	}

	var payload TempTokenPayload
	if err := json.Unmarshal([]byte(jsonData), &payload); err != nil {
		return nil, fmt.Errorf("failed to parse temporary token")
	}
	return &payload, nil
}

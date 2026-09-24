package service

import (
	"errors"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/rpsoftech/DigiGold/MainServerGo/env"
	"github.com/rpsoftech/DigiGold/MainServerGo/interfaces" // Assuming you move your Sentinel Errors here
)

// ==========================================
// CLAIMS STRUCTURES
// ==========================================

type UserClaims struct {
	UserUUID   string `json:"user_uuid"`
	TenantUUID string `json:"tenant_uuid"`
	Phone      string `json:"phone"`
	*jwt.RegisteredClaims
}

type AdminClaims struct {
	AdminUUID string `json:"admin_uuid"`
	Role      string `json:"role"`
	TenantID  int64  `json:"tenant_id"`
	*jwt.RegisteredClaims
}

type RegistrationClaims struct {
	Phone      string `json:"phone"`
	TenantUUID string `json:"tenant_uuid"`
	*jwt.RegisteredClaims
}

// Token audiences. Every token kind carries its own "aud" claim and every
// validator requires it, so one kind of token can never be replayed as another
// (e.g. a customer access token presented to the admin middleware).
const (
	audUserAccess    = "digigold:user:access"
	audUserRefresh   = "digigold:user:refresh"
	audRegistration  = "digigold:user:registration"
	audAdminAccess   = "digigold:admin:access"
	audAdminRefresh  = "digigold:admin:refresh"
	accessTokenTTL   = 15 * time.Minute
	refreshTokenTTL  = 7 * 24 * time.Hour
	registrationTTL  = 10 * time.Minute
	jwtSigningMethod = "HS256"
)

// ==========================================
// SERVICE DEFINITION & INITIALIZATION
// ==========================================

type JWTService struct {
	// Pre-allocated byte arrays for zero-allocation signing/verifying
	accessKey  []byte
	refreshKey []byte
}

var (
	jwtServiceInstance *JWTService
	jwtServiceOnce     sync.Once
)

// GetJWTService implements Thread-Safe Lazy Initialization
func GetJWTService() *JWTService {
	jwtServiceOnce.Do(func() {
		// CRITICAL OPTIMIZATION: We cast the strings to byte arrays EXACTLY ONCE on boot.
		// This saves the Garbage Collector from trashing the heap during high-traffic spikes.
		aKey := []byte(env.Env.GetEnv("ACCESS_TOKEN_KEY"))
		rKey := []byte(env.Env.GetEnv("REFRESH_TOKEN_KEY"))

		if len(aKey) < 32 || len(rKey) < 32 {
			panic("FATAL: JWT access/refresh keys must be set and at least 32 bytes long")
		}

		jwtServiceInstance = &JWTService{
			accessKey:  aKey,
			refreshKey: rKey,
		}
	})
	return jwtServiceInstance
}

func newRegisteredClaims(audience string, ttl time.Duration) *jwt.RegisteredClaims {
	now := time.Now()
	return &jwt.RegisteredClaims{
		Audience:  jwt.ClaimStrings{audience},
		ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
		IssuedAt:  jwt.NewNumericDate(now),
	}
}

func sign(claims jwt.Claims, key []byte) (string, error) {
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(key)
}

// parse validates signature, algorithm, expiry and audience, then fills claims.
func parse(tokenStr string, claims jwt.Claims, key []byte, audience string) error {
	token, err := jwt.ParseWithClaims(tokenStr, claims,
		func(*jwt.Token) (any, error) { return key, nil },
		jwt.WithValidMethods([]string{jwtSigningMethod}),
		jwt.WithAudience(audience),
		jwt.WithExpirationRequired(),
	)
	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return interfaces.ErrTokenExpired
		}
		return interfaces.ErrInvalidToken
	}
	if !token.Valid {
		return interfaces.ErrInvalidToken
	}
	return nil
}

// ==========================================
// GENERATION METHODS
// ==========================================

// GenerateTokens generates both Access (15m) and Refresh (7d) tokens for a user
func (s *JWTService) GenerateTokens(userUUID string, tenantUUID string, phone string) (string, string, error) {
	accessToken, err := sign(&UserClaims{
		UserUUID:         userUUID,
		TenantUUID:       tenantUUID,
		Phone:            phone,
		RegisteredClaims: newRegisteredClaims(audUserAccess, accessTokenTTL),
	}, s.accessKey)
	if err != nil {
		return "", "", err
	}

	refreshToken, err := sign(&UserClaims{
		UserUUID:         userUUID,
		TenantUUID:       tenantUUID,
		Phone:            phone,
		RegisteredClaims: newRegisteredClaims(audUserRefresh, refreshTokenTTL),
	}, s.refreshKey)
	if err != nil {
		return "", "", err
	}

	return accessToken, refreshToken, nil
}

// GenerateRegistrationToken generates a short-lived token (10m) for registration after OTP verification
func (s *JWTService) GenerateRegistrationToken(phone string, tenantUUID string) (string, error) {
	return sign(&RegistrationClaims{
		Phone:            phone,
		TenantUUID:       tenantUUID,
		RegisteredClaims: newRegisteredClaims(audRegistration, registrationTTL),
	}, s.accessKey)
}

// GenerateAdminTokens generates both Access (15m) and Refresh (7d) tokens for an admin
func (s *JWTService) GenerateAdminTokens(adminUUID string, role string, tenantID int64) (string, string, error) {
	accessToken, err := sign(&AdminClaims{
		AdminUUID:        adminUUID,
		Role:             role,
		TenantID:         tenantID,
		RegisteredClaims: newRegisteredClaims(audAdminAccess, accessTokenTTL),
	}, s.accessKey)
	if err != nil {
		return "", "", err
	}

	refreshToken, err := sign(&AdminClaims{
		AdminUUID:        adminUUID,
		Role:             role,
		TenantID:         tenantID,
		RegisteredClaims: newRegisteredClaims(audAdminRefresh, refreshTokenTTL),
	}, s.refreshKey)
	if err != nil {
		return "", "", err
	}

	return accessToken, refreshToken, nil
}

// ==========================================
// VALIDATION METHODS
// ==========================================

// ValidateAccessToken validates the access token and returns the claims
func (s *JWTService) ValidateAccessToken(tokenStr string) (*UserClaims, error) {
	claims := &UserClaims{}
	if err := parse(tokenStr, claims, s.accessKey, audUserAccess); err != nil {
		return nil, err
	}
	if claims.UserUUID == "" || claims.TenantUUID == "" {
		return nil, interfaces.ErrInvalidToken
	}
	return claims, nil
}

// ValidateRefreshToken validates the refresh token and returns the claims
func (s *JWTService) ValidateRefreshToken(tokenStr string) (*UserClaims, error) {
	claims := &UserClaims{}
	if err := parse(tokenStr, claims, s.refreshKey, audUserRefresh); err != nil {
		return nil, err
	}
	if claims.UserUUID == "" || claims.TenantUUID == "" {
		return nil, interfaces.ErrInvalidToken
	}
	return claims, nil
}

// ValidateRegistrationToken validates the registration token and returns phone and tenantUUID
func (s *JWTService) ValidateRegistrationToken(tokenStr string) (string, string, error) {
	claims := &RegistrationClaims{}
	if err := parse(tokenStr, claims, s.accessKey, audRegistration); err != nil {
		return "", "", err
	}
	if claims.Phone == "" || claims.TenantUUID == "" {
		return "", "", interfaces.ErrInvalidToken
	}
	return claims.Phone, claims.TenantUUID, nil
}

// ValidateAdminToken validates a JWT issued by GenerateAdminTokens and returns AdminClaims.
func (s *JWTService) ValidateAdminToken(tokenStr string) (*AdminClaims, error) {
	claims := &AdminClaims{}
	if err := parse(tokenStr, claims, s.accessKey, audAdminAccess); err != nil {
		return nil, err
	}
	if claims.AdminUUID == "" || claims.Role == "" || claims.TenantID == 0 {
		return nil, interfaces.ErrInvalidToken
	}
	return claims, nil
}

// ValidateAdminRefreshToken validates a refresh token issued by GenerateAdminTokens and returns AdminClaims.
func (s *JWTService) ValidateAdminRefreshToken(tokenStr string) (*AdminClaims, error) {
	claims := &AdminClaims{}
	if err := parse(tokenStr, claims, s.refreshKey, audAdminRefresh); err != nil {
		return nil, err
	}
	if claims.AdminUUID == "" || claims.TenantID == 0 {
		return nil, interfaces.ErrInvalidToken
	}
	return claims, nil
}

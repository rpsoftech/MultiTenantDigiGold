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

type RegistrationClaims struct {
	Phone      string `json:"phone"`
	TenantUUID string `json:"tenant_uuid"`
	*jwt.RegisteredClaims
}

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

		if len(aKey) == 0 || len(rKey) == 0 {
			panic("FATAL: JWT access/refresh keys are missing from environment")
		}

		jwtServiceInstance = &JWTService{
			accessKey:  aKey,
			refreshKey: rKey,
		}
	})
	return jwtServiceInstance
}

// ==========================================
// GENERATION METHODS
// ==========================================

// GenerateTokens generates both Access (15m) and Refresh (7d) tokens for a user
func (s *JWTService) GenerateTokens(userUUID string, tenantUUID string, phone string) (string, string, error) {
	now := time.Now()
	// 1. Access Token (15 minutes)
	accessClaims := &UserClaims{
		UserUUID:   userUUID,
		TenantUUID: tenantUUID,
		Phone:      phone,
		RegisteredClaims: &jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(15 * time.Minute)),
			IssuedAt:  jwt.NewNumericDate(now),
		},
	}
	accessTokenObj := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	accessToken, err := accessTokenObj.SignedString(s.accessKey)
	if err != nil {
		return "", "", err
	}

	// 2. Refresh Token (7 days)
	refreshClaims := &UserClaims{
		UserUUID:   userUUID,
		TenantUUID: tenantUUID,
		Phone:      phone,
		RegisteredClaims: &jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(7 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(now),
		},
	}
	refreshTokenObj := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refreshToken, err := refreshTokenObj.SignedString(s.refreshKey)
	if err != nil {
		return "", "", err
	}

	return accessToken, refreshToken, nil
}

// GenerateRegistrationToken generates a short-lived token (10m) for registration after OTP verification
func (s *JWTService) GenerateRegistrationToken(phone string, tenantUUID string) (string, error) {
	claims := &RegistrationClaims{
		Phone:      phone,
		TenantUUID: tenantUUID,
		RegisteredClaims: &jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(10 * time.Minute)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	tokenObj := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return tokenObj.SignedString(s.accessKey)
}

// ==========================================
// VALIDATION METHODS
// ==========================================

// ValidateAccessToken validates the access token and returns the claims
func (s *JWTService) ValidateAccessToken(tokenStr string) (*UserClaims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &UserClaims{}, func(token *jwt.Token) (any, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, interfaces.ErrInvalidToken
		}
		return s.accessKey, nil
	})
	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, interfaces.ErrTokenExpired
		}
		return nil, interfaces.ErrInvalidToken
	}
	claims, ok := token.Claims.(*UserClaims)
	if !ok || !token.Valid {
		return nil, interfaces.ErrInvalidToken
	}
	return claims, nil
}

// ValidateRefreshToken validates the refresh token and returns the claims
func (s *JWTService) ValidateRefreshToken(tokenStr string) (*UserClaims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &UserClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, interfaces.ErrInvalidToken
		}
		return s.refreshKey, nil
	})

	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, interfaces.ErrTokenExpired
		}
		return nil, interfaces.ErrInvalidToken
	}

	claims, ok := token.Claims.(*UserClaims)
	if !ok || !token.Valid {
		return nil, interfaces.ErrInvalidToken
	}

	return claims, nil
}

// ValidateRegistrationToken validates the registration token and returns phone and tenantUUID
func (s *JWTService) ValidateRegistrationToken(tokenStr string) (string, string, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &RegistrationClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, interfaces.ErrInvalidToken
		}
		return s.accessKey, nil
	})
	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return "", "", interfaces.ErrTokenExpired
		}
		return "", "", interfaces.ErrInvalidToken
	}
	claims, ok := token.Claims.(*RegistrationClaims)
	if !ok || !token.Valid {
		return "", "", interfaces.ErrInvalidToken
	}

	return claims.Phone, claims.TenantUUID, nil
}

package service

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/rpsoftech/DigiGold/MainServerGo/interfaces"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/models"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/repository"
	redis_client "github.com/rpsoftech/DigiGold/MainServerGo/utility/redis"
)

// UserSessionService issues and refreshes customer sessions. Like admin sessions
// (AdminAuthService), every refresh token has a server-side record by its jti, so it can be
// used exactly once and is revoked on logout: a stolen customer refresh token stops working
// as soon as either party uses it, instead of staying valid for its whole 7-day life.
type UserSessionService struct {
	Redis    *redis_client.RedisClientStruct
	UserRepo *repository.UserRepository
}

var (
	userSessionServiceInstance *UserSessionService
	userSessionServiceOnce     sync.Once
)

func GetUserSessionService() *UserSessionService {
	userSessionServiceOnce.Do(func() {
		userSessionServiceInstance = &UserSessionService{
			Redis:    redis_client.InitRedisClient(),
			UserRepo: repository.GetUserRepository(),
		}
	})
	return userSessionServiceInstance
}

var errUserRefreshTokenInvalid = &interfaces.RequestError{
	StatusCode: http.StatusUnauthorized,
	Code:       interfaces.ERROR_INVALID_TOKEN,
	Name:       "REFRESH_TOKEN_INVALID",
	Message:    "Your session has expired. Please sign in again.",
}

// userRefreshKey is the server-side record of one live customer refresh token (by jti).
func userRefreshKey(refreshID string) string {
	return "auth:user_refresh:" + refreshID
}

// IssueTokens signs a customer token pair and records the refresh token.
func (s *UserSessionService) IssueTokens(ctx context.Context, user *models.User, tenantUUID string) (accessToken, refreshToken string, err error) {
	accessToken, refreshToken, refreshID, err := GetJWTService().GenerateUserTokenPair(user.UUID, tenantUUID, user.PhoneNumber)
	if err != nil {
		return "", "", fmt.Errorf("failed to generate tokens: %w", err)
	}
	if err := s.Redis.SetStringDataWithExpiry(ctx, userRefreshKey(refreshID), user.UUID, refreshTokenTTL); err != nil {
		return "", "", fmt.Errorf("failed to record refresh token: %w", err)
	}
	return accessToken, refreshToken, nil
}

// Refresh exchanges a customer refresh token for a new pair. The old token's record is
// consumed atomically (GETDEL); a token without a record (used, revoked, or issued before
// records existed) is rejected. The token must belong to this tenant and its customer must
// still exist.
func (s *UserSessionService) Refresh(ctx context.Context, refreshToken string, tenantID int64, tenantUUID string) (accessToken, newRefreshToken string, err error) {
	claims, err := GetJWTService().ValidateRefreshToken(refreshToken)
	if err != nil || claims.ID == "" || claims.TenantUUID != tenantUUID {
		return "", "", errUserRefreshTokenInvalid
	}

	key := userRefreshKey(claims.ID)
	owner, err := s.Redis.Client.GetDel(ctx, s.Redis.GetRedisKey(key)).Result()
	if errors.Is(err, redis.Nil) || (err == nil && owner != claims.UserUUID) {
		return "", "", errUserRefreshTokenInvalid
	}
	if err != nil {
		return "", "", fmt.Errorf("failed to read refresh token record: %w", err)
	}

	// From here on a server fault must not end the session: put the consumed record back so
	// the same refresh token can be retried. Client errors keep it consumed.
	defer func() {
		if !isServerFault(err) {
			return
		}
		if remaining := time.Until(claims.ExpiresAt.Time); remaining > 0 {
			_ = s.Redis.SetStringDataWithExpiry(context.Background(), key, owner, remaining)
		}
	}()

	user, err := s.UserRepo.GetFullUserByUUID(ctx, tenantID, claims.UserUUID)
	if errors.Is(err, interfaces.ErrUserNotFound) {
		return "", "", errUserRefreshTokenInvalid
	}
	if err != nil {
		return "", "", err
	}
	return s.IssueTokens(ctx, user, tenantUUID)
}

// Revoke ends the session a refresh token belongs to (logout). An invalid or already-revoked
// token is not an error: the outcome the caller wants holds.
func (s *UserSessionService) Revoke(ctx context.Context, refreshToken string) error {
	claims, err := GetJWTService().ValidateRefreshToken(refreshToken)
	if err != nil || claims.ID == "" {
		return nil
	}
	if err := s.Redis.RemoveKey(ctx, userRefreshKey(claims.ID)); err != nil {
		return fmt.Errorf("failed to revoke refresh token: %w", err)
	}
	return nil
}

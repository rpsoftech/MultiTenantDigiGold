package service

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"

	"github.com/redis/go-redis/v9"
	"sync"
	"time"

	"github.com/rpsoftech/DigiGold/MainServerGo/events"
	"github.com/rpsoftech/DigiGold/MainServerGo/interfaces"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/repository"
	utility_functions "github.com/rpsoftech/DigiGold/MainServerGo/utility/functions"
	redis_client "github.com/rpsoftech/DigiGold/MainServerGo/utility/redis"
)

// OTPCacheSession is the live OTP for one phone: the code and how often it was resent. Wrong
// guesses are counted separately (getVerifyAttemptsKey).
type OTPCacheSession struct {
	*interfaces.OTPRequest
	ResendAttempts int `json:"resend_attempts"`
}

type OTPService struct {
	Redis      *redis_client.RedisClientStruct
	EventRepo  *repository.EventRepository
	UserRepo   *repository.UserRepository
	tenantRepo *repository.TenantRepository
}

var (
	otpServiceInstance *OTPService
	otpServiceOnce     sync.Once
)

const (
	otpExpiration    = time.Minute * 10 // Increased to 10 mins to hold the lockout state
	otpCoolDown      = time.Second * 30
	maxResendRetries = 5 // Blocks WhatsApp API spam
	maxVerifyRetries = 5 // Blocks brute-force guessing
)

func GetOTPService() *OTPService {
	otpServiceOnce.Do(func() {
		otpServiceInstance = &OTPService{
			Redis:     redis_client.InitRedisClient(),
			EventRepo: repository.GetEventRepository(),
			UserRepo:  repository.GetUserRepository(),
		}
	})
	return otpServiceInstance
}

// generateSecureOTP returns a random 6-digit code. If the OS random source fails there is no
// safe code to send, so the request fails (it used to fall back to a fixed "123456").
func generateSecureOTP() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(900000))
	if err != nil {
		return "", fmt.Errorf("failed to generate OTP: %w", err)
	}
	return fmt.Sprintf("%06d", n.Int64()+100000), nil
}

func (s *OTPService) getOTPKey(tenantUUID string, phone string) string {
	return fmt.Sprintf("tenant:%s:otp_session:%s", tenantUUID, phone)
}

func (s *OTPService) getCoolDownKey(tenantUUID string, phone string) string {
	return fmt.Sprintf("tenant:%s:otp_coolDown:%s", tenantUUID, phone)
}

// getVerifyAttemptsKey counts wrong guesses for one issued OTP (by its request ID), so a
// resend starts a fresh count.
func (s *OTPService) getVerifyAttemptsKey(tenantUUID string, reqID string) string {
	return fmt.Sprintf("tenant:%s:otp_attempts:%s", tenantUUID, reqID)
}

func (s *OTPService) SendOTP(ctx context.Context, tenantID int64, tenantUUID string, phone string) (bool, error) {
	user, err := s.UserRepo.GetFullUserByPhone(ctx, tenantID, phone)

	isRegistered := true
	name := "Customer"

	if err != nil {
		if errors.Is(err, interfaces.ErrUserNotFound) {
			isRegistered = false
		} else {
			return false, err
		}
	} else if user.FullName != nil {
		name = *user.FullName
	}

	err = s.GenerateAndDispatch(ctx, tenantUUID, phone, name)
	if err != nil {
		return false, err
	}

	return isRegistered, nil
}

// ==========================================
// CORE OPERATIONS
// ==========================================

func (s *OTPService) GenerateAndDispatch(ctx context.Context, tenantUUID string, phone string, name string) error {
	coolDownKey := s.getCoolDownKey(tenantUUID, phone)
	sessionKey := s.getOTPKey(tenantUUID, phone)

	// 1. SPAM PREVENTION: Check 30-second coolDownKey
	if exists, _ := s.Redis.GetStringData(ctx, coolDownKey); exists != "" {
		return interfaces.ErrRecentOTPReqExist
	}

	// 2. ATTEMPT TRACKING: Fetch existing session (if any)
	var session OTPCacheSession
	if existingData, err := s.Redis.GetStringData(ctx, sessionKey); err == nil && existingData != "" {
		json.Unmarshal([]byte(existingData), &session)

		// If they have hit the limit, block them. They must wait for the 10-minute TTL to expire.
		if session.ResendAttempts >= maxResendRetries {
			return interfaces.ErrMaxResendAttempts
		}
	}
	otpCode, err := generateSecureOTP()
	if err != nil {
		return err
	}
	otpReqEntity := &interfaces.OTPRequest{
		TenantId: tenantUUID,
		Phone:    phone,
		Name:     name,
		OtpCode:  otpCode,
		ReqId:    utility_functions.GenerateNewUUID(),
	}
	// 3. Update Session State (a new ReqId also starts a new wrong-guess count)
	session.OTPRequest = otpReqEntity
	session.ResendAttempts++

	// 4. Save Session to Redis. Without it the code could never be verified, so don't send it.
	sessionBytes, _ := json.Marshal(session)
	if err := s.Redis.SetStringDataWithExpiry(ctx, sessionKey, string(sessionBytes), otpExpiration); err != nil {
		return fmt.Errorf("failed to save OTP session: %w", err)
	}
	s.Redis.SetStringDataWithExpiry(ctx, coolDownKey, "locked", otpCoolDown)

	// 5. EVENT PIPELINE & OUTBOX. The event carries no code: system_events is an audit log
	// and must not hold live login codes. The WhatsApp worker reads the code from the session
	// (PendingOTPCode) when it sends.
	event := events.CreateNewOTPReqEvent(&interfaces.OTPRequest{
		TenantId: otpReqEntity.TenantId,
		Phone:    otpReqEntity.Phone,
		Name:     otpReqEntity.Name,
		ReqId:    otpReqEntity.ReqId,
	})

	if err := s.EventRepo.SaveEventWithContext(ctx, event.BaseEvent); err != nil {
		return fmt.Errorf("failed to save OTP event: %w", err)
	}

	return nil
}

// PendingOTPCode returns the code of the OTP request reqID if it is still the live one for
// the phone. ok is false when it was verified, expired or replaced by a resend: the worker
// then sends nothing (a resend has its own event).
func (s *OTPService) PendingOTPCode(ctx context.Context, tenantUUID, phone, reqID string) (code string, ok bool, err error) {
	data, err := s.Redis.GetStringData(ctx, s.getOTPKey(tenantUUID, phone))
	if errors.Is(err, redis.Nil) || (err == nil && data == "") {
		return "", false, nil
	}
	if err != nil {
		return "", false, fmt.Errorf("failed to read OTP session: %w", err)
	}
	var session OTPCacheSession
	if err := json.Unmarshal([]byte(data), &session); err != nil || session.OTPRequest == nil {
		return "", false, nil
	}
	if session.ReqId != reqID || session.OtpCode == "" {
		return "", false, nil
	}
	return session.OtpCode, true, nil
}

func (s *OTPService) VerifyOTP(ctx context.Context, tenantUUID string, phone string, inputOTP string) error {
	sessionKey := s.getOTPKey(tenantUUID, phone)
	// 1. Fetch Session from Redis
	existingData, err := s.Redis.GetStringData(ctx, sessionKey)
	if err != nil || existingData == "" {
		return interfaces.ErrOTPReqNotFound
	}

	var session OTPCacheSession
	if err := json.Unmarshal([]byte(existingData), &session); err != nil {
		return interfaces.ErrOTPReqNotFound
	}

	if session.OTPRequest == nil {
		return interfaces.ErrOTPReqNotFound
	}
	attemptsKey := s.getVerifyAttemptsKey(tenantUUID, session.ReqId)

	// 2. BRUTE-FORCE PROTECTION. Every guess is counted with an atomic INCR before the code
	// is compared, so parallel requests can't all read the same count and get more than
	// maxVerifyRetries guesses (they could with the count stored inside the session JSON).
	attempts, err := s.Redis.Client.Incr(ctx, s.Redis.GetRedisKey(attemptsKey)).Result()
	if err != nil {
		return fmt.Errorf("failed to count OTP attempt: %w", err)
	}
	if attempts == 1 {
		s.Redis.Client.Expire(ctx, s.Redis.GetRedisKey(attemptsKey), otpExpiration)
	}
	if attempts > maxVerifyRetries {
		s.Redis.RemoveKey(ctx, sessionKey, attemptsKey) // Burn the code completely
		return interfaces.ErrMaxVerifyAttempts
	}

	// 3. VALIDATE OTP
	if subtle.ConstantTimeCompare([]byte(session.OtpCode), []byte(inputOTP)) != 1 {
		return interfaces.ErrOTPInvalid
	}

	// 4. SUCCESS: Burn the key to prevent replay attacks
	s.Redis.RemoveKey(ctx, sessionKey, attemptsKey)

	return nil
}

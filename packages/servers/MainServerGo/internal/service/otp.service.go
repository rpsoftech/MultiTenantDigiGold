package service

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"sync"
	"time"

	"github.com/rpsoftech/DigiGold/MainServerGo/events"
	"github.com/rpsoftech/DigiGold/MainServerGo/interfaces"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/repository"
	utility_functions "github.com/rpsoftech/DigiGold/MainServerGo/utility/functions"
	redis_client "github.com/rpsoftech/DigiGold/MainServerGo/utility/redis"
)

// OTPCacheSession replaces the raw string in Redis to hold attempt state
type OTPCacheSession struct {
	*interfaces.OTPRequest
	ResendAttempts int `json:"resend_attempts"`
	VerifyAttempts int `json:"verify_attempts"`
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

func (s *OTPService) generateSecureOTP() string {
	max := big.NewInt(900000)
	n, err := rand.Int(rand.Reader, max)
	if err != nil {
		return "123456" // Fallback in catastrophic OS crypto failure
	}
	return fmt.Sprintf("%06d", n.Int64()+100000)
}

func (s *OTPService) getOTPKey(tenantID string, phone string) string {
	return fmt.Sprintf("tenant:%s:otp_session:%s", tenantID, phone)
}

func (s *OTPService) getCoolDownKey(tenantID string, phone string) string {
	return fmt.Sprintf("tenant:%s:otp_coolDown:%s", tenantID, phone)
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

func (s *OTPService) GenerateAndDispatch(ctx context.Context, tenantID string, phone string, name string) error {
	coolDownKey := s.getCoolDownKey(tenantID, phone)
	sessionKey := s.getOTPKey(tenantID, phone)

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
	otpCode := s.generateSecureOTP()
	otpReqEntity := &interfaces.OTPRequest{
		TenantId: tenantID,
		Phone:    phone,
		Name:     name,
		OtpCode:  otpCode,
		ReqId:    utility_functions.GenerateNewUUID(),
	}
	// 3. Update Session State
	session.OTPRequest = otpReqEntity
	session.ResendAttempts++
	session.VerifyAttempts = 0 // Reset verify attempts for the new OTP

	// 4. Save Session to Redis
	sessionBytes, _ := json.Marshal(session)
	s.Redis.SetStringDataWithExpiry(ctx, sessionKey, string(sessionBytes), otpExpiration)
	s.Redis.SetStringDataWithExpiry(ctx, coolDownKey, "locked", otpCoolDown)

	// 5. EVENT PIPELINE & OUTBOX (Same as before)
	event := events.CreateNewOTPReqEvent(otpReqEntity)

	if err := s.EventRepo.SaveEventWithContext(ctx, event.BaseEvent); err != nil {
		return fmt.Errorf("failed to save OTP event: %w", err)
	}

	return nil
}

func (s *OTPService) VerifyOTP(ctx context.Context, tenantID string, phone string, inputOTP string) error {
	sessionKey := s.getOTPKey(tenantID, phone)

	// 1. Fetch Session from Redis
	existingData, err := s.Redis.GetStringData(ctx, sessionKey)
	if err != nil || existingData == "" {
		return interfaces.ErrOTPReqNotFound
	}

	var session OTPCacheSession
	if err := json.Unmarshal([]byte(existingData), &session); err != nil {
		return interfaces.ErrOTPReqNotFound
	}

	// 2. BRUTE-FORCE PROTECTION: Are they locked out?
	if session.VerifyAttempts >= maxVerifyRetries {
		s.Redis.RemoveKey(ctx, sessionKey) // Burn the key completely
		return interfaces.ErrMaxVerifyAttempts
	}

	// 3. VALIDATE OTP
	if session.OtpCode != inputOTP {
		// Increment bad guesses and save back to Redis
		session.VerifyAttempts++
		sessionBytes, _ := json.Marshal(session)

		// We use standard 'Set' here to update the attempts without renewing the 10-minute expiration limit
		s.Redis.SetStringDataKeepTTL(ctx, sessionKey, string(sessionBytes))

		return interfaces.ErrOTPInvalid
	}

	// 4. SUCCESS: Burn the key to prevent replay attacks
	s.Redis.RemoveKey(ctx, sessionKey)

	return nil
}

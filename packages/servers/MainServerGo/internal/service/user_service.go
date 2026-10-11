package service

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/rpsoftech/DigiGold/MainServerGo/events"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/models"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/repository"
	utility_functions "github.com/rpsoftech/DigiGold/MainServerGo/utility/functions"
	"github.com/rpsoftech/DigiGold/MainServerGo/utility/postgres"
)

type UserService struct {
	UserRepo  *repository.UserRepository
	EventRepo *repository.EventRepository
	DB        *postgres.PostgresDBStruct
}

var (
	userServiceInstance *UserService
	userServiceOnce     sync.Once
)

func GetUserService() *UserService {
	userServiceOnce.Do(func() {
		userServiceInstance = &UserService{
			UserRepo:  repository.GetUserRepository(),
			EventRepo: repository.GetEventRepository(),
			DB:        postgres.GetPostgresDB(),
		}
	})
	return userServiceInstance
}

func (s *UserService) RegisterUser(ctx context.Context, tenantID int64, phone, fullName, emailID, city string) (*models.User, error) {
	// 1. Start SQL Transaction in the Service Layer
	tx, err := s.DB.Db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// 2. Instantiate the User model
	user := &models.User{
		UUID:         utility_functions.GenerateNewUUID(),
		TenantID:     tenantID,
		FullName:     &fullName,
		PhoneNumber:  phone,
		EmailID:      &emailID,
		City:         &city,
		KYCStatus:    "pending",
		DocumentJSON: json.RawMessage("{}"),
		VaultBalance: 0.0,
	}

	// 3. Save User via Repository inside the transaction
	if err := s.UserRepo.CreateFullUserWithTx(ctx, tx, user); err != nil {
		return nil, err
	}

	// 4. Commit Transaction
	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return user, nil
}

// DecideKYC approves ("verified") or rejects ("rejected") a customer's KYC submission and
// writes a KYC_DECIDED audit event in the same transaction, so the decision and its record
// stand or fall together. Returns false when the customer had no submission waiting.
func (s *UserService) DecideKYC(ctx context.Context, u *models.User, status, tenantUUID, adminUUID, ipAddress string) (bool, error) {
	tx, err := s.DB.Db.BeginTx(ctx, nil)
	if err != nil {
		return false, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	decided, err := s.UserRepo.DecideKYCWithTX(ctx, tx, u, status, adminUUID)
	if err != nil || !decided {
		return false, err
	}
	event := events.GenerateKYCDecidedEvent(tenantUUID, adminUUID, ipAddress,
		events.KYCDecision{UserUUID: u.UUID, Status: status})
	if err := s.EventRepo.SaveEventWithTx(ctx, tx, event); err != nil {
		return false, fmt.Errorf("failed to save kyc decision event: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return false, fmt.Errorf("failed to commit kyc decision: %w", err)
	}

	// Synchronous, unlike the profile-update paths: the cached row is what InitiateBuy and
	// GET /user/kyc read, so a stale entry would keep a just-approved customer blocked from
	// KYC-gated purchases for the full cache TTL.
	s.UserRepo.InvalidateUserCaches(ctx, u)
	s.EventRepo.PublishAsync(event)
	return true, nil
}

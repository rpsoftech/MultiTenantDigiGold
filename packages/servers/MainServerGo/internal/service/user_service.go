package service

import (
	"context"
	"encoding/json"
	"sync"

	"github.com/rpsoftech/DigiGold/MainServerGo/internal/models"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/repository"
	utility_functions "github.com/rpsoftech/DigiGold/MainServerGo/utility/functions"
	"github.com/rpsoftech/DigiGold/MainServerGo/utility/postgres"
)

type UserService struct {
	UserRepo *repository.UserRepository
	DB       *postgres.PostgresDBStruct
}

var (
	userServiceInstance *UserService
	userServiceOnce     sync.Once
)

func GetUserService() *UserService {
	userServiceOnce.Do(func() {
		userServiceInstance = &UserService{
			UserRepo: repository.GetUserRepository(),
			DB:       postgres.GetPostgresDB(),
		}
	})
	return userServiceInstance
}

func (s *UserService) RegisterUser(ctx context.Context, tenantID int64, phone string, fullName string, emailID *string) (*models.User, error) {
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
		EmailID:      emailID,
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

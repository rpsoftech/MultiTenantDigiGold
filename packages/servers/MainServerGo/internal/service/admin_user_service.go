package service

import (
	"context"
	"fmt"
	"sync"

	"github.com/rpsoftech/DigiGold/MainServerGo/events"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/models"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/repository"
	"github.com/rpsoftech/DigiGold/MainServerGo/utility/postgres"
)

type AdminUserService struct {
	DB         *postgres.PostgresDBStruct
	AdminRepo  *repository.TenantUserLoginRepository
	TenantRepo *repository.TenantRepository
	EventRepo  *repository.EventRepository
}

var (
	adminUserServiceInstance *AdminUserService
	adminUserServiceOnce     sync.Once
)

func GetAdminUserService() *AdminUserService {
	adminUserServiceOnce.Do(func() {
		adminUserServiceInstance = &AdminUserService{
			DB:         postgres.GetPostgresDB(),
			AdminRepo:  repository.GetTenantUserLoginRepository(),
			TenantRepo: repository.GetTenantRepository(),
			EventRepo:  repository.GetEventRepository(),
		}
	})
	return adminUserServiceInstance
}

func (s *AdminUserService) GetAdminsPaginated(ctx context.Context, tenantUUID string, page, limit int) ([]*models.TenantUserLogin, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	if tenantUUID == "" {
		return s.AdminRepo.GetAllAdminsPaginated(ctx, limit, offset)
	}

	tenantID, err := s.TenantRepo.TenantUUIDtoID(ctx, tenantUUID)
	if err != nil || tenantID == 0 {
		return nil, 0, fmt.Errorf("invalid tenant UUID: %w", err)
	}

	return s.AdminRepo.GetAllAdminsByTenantPaginated(ctx, tenantID, limit, offset)
}

func (s *AdminUserService) GetAdminByUUID(ctx context.Context, tenantUUID, adminUUID string) (*models.TenantUserLogin, error) {
	tenantID, err := s.TenantRepo.TenantUUIDtoID(ctx, tenantUUID)
	if err != nil || tenantID == 0 {
		return nil, fmt.Errorf("invalid tenant UUID: %w", err)
	}
	return s.AdminRepo.GetFullAdminByUUID(ctx, tenantID, adminUUID)
}

func (s *AdminUserService) CreateAdmin(ctx context.Context, admin *models.TenantUserLogin, masterAdminUUID string) error {
	tx, err := s.DB.Db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if err := s.AdminRepo.CreateFullAdminWithTx(ctx, tx, admin); err != nil {
		return err
	}

	// Emit Event
	event := &events.BaseEvent{
		EventName: "ADMIN_CREATED",
		TenantId:  fmt.Sprintf("%d", admin.TenantID),
		KeyId:     admin.UUID,
		AdminId:   masterAdminUUID,
		Payload:   admin,
	}
	event.CreateBaseEvent()
	
	if err := s.EventRepo.SaveEventWithTx(ctx, tx, event); err != nil {
		return err
	}

	return tx.Commit()
}

func (s *AdminUserService) UpdateAdmin(ctx context.Context, admin *models.TenantUserLogin, masterAdminUUID string) error {
	tx, err := s.DB.Db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if err := s.AdminRepo.UpdateFullAdminWithTx(ctx, tx, admin); err != nil {
		return err
	}

	// Emit Event
	event := &events.BaseEvent{
		EventName: "ADMIN_UPDATED",
		TenantId:  fmt.Sprintf("%d", admin.TenantID),
		KeyId:     admin.UUID,
		AdminId:   masterAdminUUID,
		Payload:   admin,
	}
	event.CreateBaseEvent()
	
	if err := s.EventRepo.SaveEventWithTx(ctx, tx, event); err != nil {
		return err
	}

	return tx.Commit()
}

package service

import (
	"context"
	"database/sql"
	"sync"

	"github.com/rpsoftech/DigiGold/MainServerGo/events"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/models"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/repository"
	utility_functions "github.com/rpsoftech/DigiGold/MainServerGo/utility/functions"
	"github.com/rpsoftech/DigiGold/MainServerGo/utility/postgres"
)

type TenantConfigService struct {
	DB         *postgres.PostgresDBStruct
	ConfigRepo *repository.TenantConfigRepository
	TenantRepo *repository.TenantRepository
	EventRepo  *repository.EventRepository
}

var (
	tenantConfigServiceInstance *TenantConfigService
	tenantConfigServiceOnce     sync.Once
)

func GetTenantConfigService() *TenantConfigService {
	tenantConfigServiceOnce.Do(func() {
		tenantConfigServiceInstance = &TenantConfigService{
			DB:         postgres.GetPostgresDB(),
			ConfigRepo: repository.GetTenantConfigRepository(),
			TenantRepo: repository.GetTenantRepository(),
			EventRepo:  repository.GetEventRepository(),
		}
	})
	return tenantConfigServiceInstance
}

func (s *TenantConfigService) CreateTenant(ctx context.Context, tenant *models.Tenant, adminUUID string) error {
	tx, err := s.DB.Db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if tenant.UUID == "" {
		tenant.UUID = utility_functions.GenerateNewUUID()
	}

	// 1. CRITICAL FIX: Check the error when creating the Tenant
	if err := s.TenantRepo.CreateFullTenantWithTX(ctx, tx, tenant); err != nil {
		return err
	}

	// 2. NEW: Generate and save the TenantCreated Audit Event
	tenantCreatedEvent := events.CreateNewTenantCreated(tenant, adminUUID)
	if err := s.EventRepo.SaveEventWithTx(ctx, tx, tenantCreatedEvent.BaseEvent); err != nil {
		return err
	}

	// 3. Initialize default internal config
	newConfig := &models.TenantInternalConfig{
		TenantID: tenant.ID,
	}

	// 4. Create the config AND generate the TenantConfigUpdated event
	if err := s.updateTenantConfigTx(ctx, tx, newConfig, adminUUID, tenant.UUID); err != nil {
		return err
	}

	// 5. Commit all records (Tenant, Config, and both Events) atomically
	return tx.Commit()
}

func (s *TenantConfigService) updateTenantConfigTx(ctx context.Context, tx *sql.Tx, newConfig *models.TenantInternalConfig, adminUUID string, tenantUUID string) error {
	// 3. Step 1: Save the configuration
	if err := s.ConfigRepo.UpsertConfigWithTx(ctx, tx, newConfig); err != nil {
		return err
	}

	// 4. Step 2: Generate and save the audit event
	auditEvent := events.CreateNewTenantConfigUpdated(newConfig, adminUUID, tenantUUID)
	if err := s.EventRepo.SaveEventWithTx(ctx, tx, auditEvent); err != nil {
		return err
	}
	return nil
}

func (s *TenantConfigService) UpdateTenantConfig(ctx context.Context, newConfig *models.TenantInternalConfig, adminUUID string, tenantUUID string) error {

	// 1. Initiate the ACID Transaction using the active HTTP context
	tx, err := s.DB.Db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}

	// 2. Guarantee a rollback if the function exits before tx.Commit() is called
	defer tx.Rollback()

	// 3. Step 1: Save the configuration
	if err := s.updateTenantConfigTx(ctx, tx, newConfig, adminUUID, tenantUUID); err != nil {
		return err
	}
	// 5. Commit both actions to PostgreSQL simultaneously
	return tx.Commit()
}

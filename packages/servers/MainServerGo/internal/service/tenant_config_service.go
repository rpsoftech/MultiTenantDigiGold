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
	MarginRepo *repository.MarginRepository
	AdminRepo  *repository.TenantUserLoginRepository
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
			MarginRepo: repository.InitMarginRepository(),
			AdminRepo:  repository.GetTenantUserLoginRepository(),
		}
	})
	return tenantConfigServiceInstance
}

func (s *TenantConfigService) CreateTenant(ctx context.Context, tenant *models.Tenant, adminUser *models.TenantUserLogin, adminUUID string) error {
	tx, err := s.DB.Db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if tenant.UUID == "" {
		tenant.UUID = utility_functions.GenerateNewUUID()
	}

	// 1. Create the Tenant
	if err := s.TenantRepo.CreateFullTenantWithTX(ctx, tx, tenant); err != nil {
		return err
	}

	// 2. Generate and save the TenantCreated Audit Event
	tenantCreatedEvent := events.CreateNewTenantCreated(tenant, adminUUID)
	if err := s.EventRepo.SaveEventWithTx(ctx, tx, tenantCreatedEvent.BaseEvent); err != nil {
		return err
	}

	// 3. Initialize default internal config
	newConfig := &models.TenantInternalConfig{
		TenantID: tenant.ID,
	}
	if err := s.updateTenantConfigTx(ctx, tx, newConfig, adminUUID, tenant.UUID); err != nil {
		return err
	}

	// 4. Insert margin_configurations: Default 0 margin and base B2B credit limit
	defaultMargin := &models.MarginConfig{
		TenantID:               tenant.ID,
		CommodityType:          "GOLD",
		SellMarginType:         "FIXED_INR",
		SellMarginValue:        0.00,
		IsGSTEnabled:           true,
		GSTPercentage:          3.00,
		TenantCreditLimitGrams: 0.0000,
		TenantUnLiftedGrams:    0.0000,
		IsActive:               true,
	}
	if err := s.MarginRepo.CreateMarginConfigWithTx(ctx, tx, defaultMargin); err != nil {
		return err
	}

	// 5. Insert tenant_user_logins: Create the root Store Admin (flagged for mandatory TOTP)
	adminUser.TenantID = tenant.ID
	if adminUser.UUID == "" {
		adminUser.UUID = utility_functions.GenerateNewUUID()
	}
	adminUser.Role = "super_admin"
	adminUser.IsActive = true
	adminUser.IsTOTPEnabled = true // Mandatory TOTP on first login

	if err := s.AdminRepo.CreateFullAdminWithTx(ctx, tx, adminUser); err != nil {
		return err
	}

	// 6. Commit all records atomically
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

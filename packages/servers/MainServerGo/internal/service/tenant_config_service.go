package service

import (
	"context"
	"database/sql"
	"fmt"
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

// ==========================================
// READ OPERATIONS (Phase B)
// ==========================================

func (s *TenantConfigService) GetTenantsPaginated(ctx context.Context, page, limit int) ([]*models.Tenant, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit
	return s.TenantRepo.GetAllTenantsPaginated(ctx, limit, offset)
}

func (s *TenantConfigService) GetTenantByUUID(ctx context.Context, uuid string) (*models.Tenant, error) {
	return s.TenantRepo.GetFullTenantByUUID(ctx, uuid)
}

func (s *TenantConfigService) GetTenantMargins(ctx context.Context, tenantUUID string) ([]*models.MarginConfig, error) {
	tenantIntID, err := s.TenantRepo.TenantUUIDtoID(ctx, tenantUUID)
	if err != nil || tenantIntID == 0 {
		return nil, fmt.Errorf("invalid tenant UUID: %w", err)
	}
	return s.MarginRepo.GetAllMarginsByTenant(ctx, tenantIntID)
}

func (s *TenantConfigService) GetTenantKYC(ctx context.Context, tenantUUID string) ([]*models.TenantKYCDocument, error) {
	tenantIntID, err := s.TenantRepo.TenantUUIDtoID(ctx, tenantUUID)
	if err != nil || tenantIntID == 0 {
		return nil, fmt.Errorf("invalid tenant UUID: %w", err)
	}
	kycRepo := repository.GetTenantKYCRepository()
	return kycRepo.GetKYCDocsByTenantID(ctx, tenantIntID)
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
	tenantIntID, err := s.TenantRepo.TenantUUIDtoID(ctx, tenantUUID)
	if err != nil || tenantIntID == 0 {
		return fmt.Errorf("invalid tenant UUID: %w", err)
	}
	newConfig.TenantID = tenantIntID

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

// Stage 2: Profile Update
func (s *TenantConfigService) UpdateTenantProfile(ctx context.Context, tenant *models.Tenant, adminUUID string) error {
	tx, err := s.DB.Db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if err := s.TenantRepo.UpdateFullTenantWithTX(ctx, tx, tenant); err != nil {
		return err
	}

	auditEvent := events.CreateNewTenantUpdated(tenant, adminUUID)
	if err := s.EventRepo.SaveEventWithTx(ctx, tx, auditEvent.BaseEvent); err != nil {
		return err
	}

	return tx.Commit()
}

// Stage 4: Margin Patch
func (s *TenantConfigService) UpdateTenantMargins(ctx context.Context, margin *models.MarginConfig, adminUUID string, tenantUUID string) error {
	tenantIntID, err := s.TenantRepo.TenantUUIDtoID(ctx, tenantUUID)
	if err != nil || tenantIntID == 0 {
		return fmt.Errorf("invalid tenant UUID: %w", err)
	}
	margin.TenantID = tenantIntID

	tx, err := s.DB.Db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if err := s.MarginRepo.UpdateMarginConfigWithTx(ctx, tx, margin); err != nil {
		return err
	}

	auditEvent := events.CreateNewMarginUpdated(margin, adminUUID, tenantUUID)
	if err := s.EventRepo.SaveEventWithTx(ctx, tx, auditEvent); err != nil {
		return err
	}

	return tx.Commit()
}

// Stage 7: Launch / Status Update
func (s *TenantConfigService) UpdateTenantStatus(ctx context.Context, tenant *models.Tenant, adminUUID string) error {
	// Re-uses Tenant Profile Update underneath, but we can emit a distinct event if needed
	tx, err := s.DB.Db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if err := s.TenantRepo.UpdateFullTenantWithTX(ctx, tx, tenant); err != nil {
		return err
	}

	// Create custom TenantActivated event
	event := &events.BaseEvent{
		EventName: "TENANT_ACTIVATED",
		TenantId:  tenant.UUID,
		KeyId:     tenant.UUID,
		AdminId:   adminUUID,
		Payload:   tenant,
	}
	event.CreateBaseEvent()

	if err := s.EventRepo.SaveEventWithTx(ctx, tx, event); err != nil {
		return err
	}

	return tx.Commit()
}

// Stage 5: KYC Add
func (s *TenantConfigService) UpdateTenantKYCAdd(ctx context.Context, kycDoc *models.TenantKYCDocument, adminUUID string, tenantUUID string) error {
	tenantIntID, err := s.TenantRepo.TenantUUIDtoID(ctx, tenantUUID)
	if err != nil || tenantIntID == 0 {
		return fmt.Errorf("invalid tenant UUID: %w", err)
	}
	kycDoc.TenantID = tenantIntID

	tx, err := s.DB.Db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	kycRepo := repository.GetTenantKYCRepository()
	if err := kycRepo.CreateKYCDocWithTx(ctx, tx, kycDoc); err != nil {
		return err
	}

	auditEvent := events.CreateNewKYCDocUploaded(kycDoc, adminUUID, tenantUUID)
	if err := s.EventRepo.SaveEventWithTx(ctx, tx, auditEvent); err != nil {
		return err
	}

	return tx.Commit()
}

// Stage 6: KYC Verify
func (s *TenantConfigService) UpdateTenantKYCVerify(ctx context.Context, kycDoc *models.TenantKYCDocument, adminUUID string, tenantUUID string) error {
	tenantIntID, err := s.TenantRepo.TenantUUIDtoID(ctx, tenantUUID)
	if err != nil || tenantIntID == 0 {
		return fmt.Errorf("invalid tenant UUID: %w", err)
	}
	kycDoc.TenantID = tenantIntID

	tx, err := s.DB.Db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	kycRepo := repository.GetTenantKYCRepository()
	if err := kycRepo.VerifyKYCDocWithTx(ctx, tx, kycDoc); err != nil {
		return err
	}

	auditEvent := events.CreateNewKYCDocVerified(kycDoc, adminUUID, tenantUUID)
	if err := s.EventRepo.SaveEventWithTx(ctx, tx, auditEvent); err != nil {
		return err
	}

	return tx.Commit()
}

package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"

	"golang.org/x/crypto/bcrypt"

	"github.com/rpsoftech/DigiGold/MainServerGo/events"
	"github.com/rpsoftech/DigiGold/MainServerGo/interfaces"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/database"
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

// Every write below saves its audit events in the same transaction (the outbox), then
// publishes them and drops the affected caches only after the commit: before it, a rollback
// would leave published events for changes that never happened, and a concurrent read could
// cache the old row again.

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

func (s *TenantConfigService) GetEventsPaginated(ctx context.Context, tenantUUID, eventType, from, to string, page, limit int) ([]*events.BaseEvent, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit
	return s.EventRepo.GetEventsPaginated(ctx, tenantUUID, eventType, from, to, limit, offset)
}

// StoreAdminInput is the root store admin created together with a tenant.
type StoreAdminInput struct {
	Username    string
	PhoneNumber string
	Password    string
}

const (
	defaultKYCMode = "just_in_time"
	// minAdminPasswordLength applies to every admin password set through the API.
	minAdminPasswordLength = 8
)

// ValidateAdminPassword rejects a password too short to set for an admin.
func ValidateAdminPassword(password string) error {
	if len(password) < minAdminPasswordLength {
		return invalidInput(fmt.Sprintf("Password must be at least %d characters.", minAdminPasswordLength))
	}
	return nil
}

func invalidInput(message string) *interfaces.RequestError {
	return &interfaces.RequestError{
		StatusCode: 400,
		Code:       interfaces.ERROR_INVALID_INPUT,
		Message:    message,
		Name:       "INVALID_INPUT",
	}
}

// CreateTenant onboards a store: the tenant, its default config and margins, and its root
// store admin (a manager). The admin signs in with the given password and must set up TOTP
// on first login.
func (s *TenantConfigService) CreateTenant(ctx context.Context, tenant *models.Tenant, admin StoreAdminInput, adminUUID string) (*models.TenantUserLogin, error) {
	if tenant.FullName == "" {
		return nil, invalidInput("Tenant full_name is required.")
	}
	if admin.Username == "" || admin.PhoneNumber == "" {
		return nil, invalidInput("admin_user.username and admin_user.phone_number are required.")
	}
	if err := ValidateAdminPassword(admin.Password); err != nil {
		return nil, err
	}
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(admin.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash admin password: %w", err)
	}

	if tenant.UUID == "" {
		tenant.UUID = utility_functions.GenerateNewUUID()
	}
	if tenant.KYCMode == "" {
		tenant.KYCMode = defaultKYCMode
	}
	if len(tenant.UIJSONConfig) == 0 {
		tenant.UIJSONConfig = json.RawMessage("{}")
	}

	tx, err := s.DB.Db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// 1. The tenant and its audit event.
	if err := s.TenantRepo.CreateFullTenantWithTX(ctx, tx, tenant); err != nil {
		if isUniqueViolation(err) {
			return nil, &interfaces.RequestError{
				StatusCode: 409,
				Code:       interfaces.ERROR_INVALID_INPUT,
				Name:       "TENANT_ALREADY_EXISTS",
				Message:    "A store with that short name, domain or subdomain already exists.",
			}
		}
		return nil, err
	}
	tenantCreatedEvent := events.CreateNewTenantCreated(tenant, adminUUID)
	if err := s.EventRepo.SaveEventWithTx(ctx, tx, tenantCreatedEvent.BaseEvent); err != nil {
		return nil, err
	}

	// 2. Default internal config.
	newConfig := &models.TenantInternalConfig{TenantID: tenant.ID}
	configEvent, err := s.updateTenantConfigTx(ctx, tx, newConfig, adminUUID, tenant.UUID)
	if err != nil {
		return nil, err
	}

	// 3. Default 0 margin and base B2B credit limit.
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
		return nil, err
	}

	// 4. The root store admin. It manages only this store (super_admin is reserved for
	// platform staff, whom AdminAuthMiddleware lets act on any tenant). TOTP is not enabled
	// yet: the first login returns SETUP_TOTP. Enabling it here, with no secret, left the
	// admin unable to either set up or verify a code.
	adminUser := &models.TenantUserLogin{
		UUID:            utility_functions.GenerateNewUUID(),
		TenantID:        tenant.ID,
		Username:        admin.Username,
		PhoneNumber:     admin.PhoneNumber,
		PasswordHash:    string(passwordHash),
		Role:            "manager",
		IsActive:        true,
		IsTOTPEnabled:   false,
		PermissionsJSON: json.RawMessage("{}"),
	}
	if err := s.AdminRepo.CreateFullAdminWithTx(ctx, tx, adminUser); err != nil {
		if isUniqueViolation(err) {
			return nil, errAdminAlreadyExists
		}
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	s.EventRepo.PublishAsync(tenantCreatedEvent.BaseEvent, configEvent)
	return adminUser, nil
}

// updateTenantConfigTx saves the config and its audit event in tx and returns the event, for
// the caller to publish after commit.
func (s *TenantConfigService) updateTenantConfigTx(ctx context.Context, tx *sql.Tx, newConfig *models.TenantInternalConfig, adminUUID string, tenantUUID string) (*events.BaseEvent, error) {
	if err := s.ConfigRepo.UpsertConfigWithTx(ctx, tx, newConfig); err != nil {
		return nil, err
	}

	auditEvent := events.CreateNewTenantConfigUpdated(newConfig, adminUUID, tenantUUID)
	if err := s.EventRepo.SaveEventWithTx(ctx, tx, auditEvent); err != nil {
		return nil, err
	}
	return auditEvent, nil
}

func (s *TenantConfigService) UpdateTenantConfig(ctx context.Context, newConfig *models.TenantInternalConfig, adminUUID string, tenantUUID string) error {
	tenantIntID, err := s.TenantRepo.TenantUUIDtoID(ctx, tenantUUID)
	if err != nil || tenantIntID == 0 {
		return fmt.Errorf("invalid tenant UUID: %w", err)
	}
	newConfig.TenantID = tenantIntID

	tx, err := s.DB.Db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	auditEvent, err := s.updateTenantConfigTx(ctx, tx, newConfig, adminUUID, tenantUUID)
	if err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	// New gateway or WhatsApp credentials apply to the next payment or OTP.
	s.ConfigRepo.InvalidateConfigCache(ctx, tenantUUID)
	s.EventRepo.PublishAsync(auditEvent)
	return nil
}

// Stage 2: Profile Update. tenant holds every profile column (the controller merges the
// request into the current row), so nothing the admin didn't send is cleared. previous is
// the row before the change: its cache entries (old domain, old short name) are dropped too.
func (s *TenantConfigService) UpdateTenantProfile(ctx context.Context, tenant *models.Tenant, previous *models.Tenant, adminUUID string) error {
	if len(tenant.UIJSONConfig) == 0 {
		tenant.UIJSONConfig = json.RawMessage("{}")
	}

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

	if err := tx.Commit(); err != nil {
		return err
	}
	s.TenantRepo.InvalidateTenantCaches(ctx, tenant)
	if previous != nil {
		s.TenantRepo.InvalidateTenantCaches(ctx, previous)
	}
	s.EventRepo.PublishAsync(auditEvent.BaseEvent)
	return nil
}

// normalizeMargin checks a margin update and fills its defaults: the commodity defaults to
// GOLD, and FLAT (accepted by buyPrice) is stored as FIXED_INR, the database's name for it
// (margin_unit_enum has only PERCENTAGE and FIXED_INR). Bad values are 400s, not 500s.
func normalizeMargin(margin *models.MarginConfig) error {
	margin.CommodityType = strings.ToUpper(strings.TrimSpace(margin.CommodityType))
	if margin.CommodityType == "" {
		margin.CommodityType = "GOLD"
	}
	switch strings.ToUpper(strings.TrimSpace(margin.SellMarginType)) {
	case "PERCENTAGE":
		margin.SellMarginType = "PERCENTAGE"
	case "FIXED_INR", "FLAT":
		margin.SellMarginType = "FIXED_INR"
	default:
		return invalidInput("sell_margin_type must be PERCENTAGE or FIXED_INR.")
	}
	if margin.SellMarginValue < 0 || margin.TenantCreditLimitGrams < 0 {
		return invalidInput("sell_margin_value and tenant_credit_limit_grams can't be negative.")
	}
	if margin.GSTPercentage < 0 || margin.GSTPercentage > 100 {
		return invalidInput("gst_percentage must be between 0 and 100.")
	}
	return nil
}

// Stage 4: Margin Patch
func (s *TenantConfigService) UpdateTenantMargins(ctx context.Context, margin *models.MarginConfig, adminUUID string, tenantUUID string) error {
	if err := normalizeMargin(margin); err != nil {
		return err
	}
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
		if errors.Is(err, sql.ErrNoRows) {
			return invalidInput(fmt.Sprintf("This store has no %s margin to update.", margin.CommodityType))
		}
		return err
	}

	auditEvent := events.CreateNewMarginUpdated(margin, adminUUID, tenantUUID)
	if err := s.EventRepo.SaveEventWithTx(ctx, tx, auditEvent); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return err
	}
	// Quotes read the margin from the cache; the next quote must use the new one.
	s.MarginRepo.InvalidateMarginCache(ctx, margin.TenantID, margin.CommodityType)
	s.EventRepo.PublishAsync(auditEvent)
	return nil
}

var errCannotSuspendPlatformTenant = &interfaces.RequestError{
	StatusCode: 400,
	Code:       interfaces.ERROR_INVALID_INPUT,
	Name:       "CANNOT_SUSPEND_PLATFORM_TENANT",
	Message:    "The platform tenant, or the store you are signed in to, can't be suspended.",
}

// Stage 7: Launch / Status Update. Suspends (isActive false) or reactivates a store; only
// the active flag changes. A suspended store's customers and staff are refused within
// activeTenantTTL on every API instance; payments already captured still settle.
//
// The platform tenant, and the tenant the caller is signed in to (callerTenantUUID, from
// X-Tenant-ID), can't be suspended: platform admins sign in through it, so suspending it
// would refuse every one of them, including the one who could reactivate it.
func (s *TenantConfigService) UpdateTenantStatus(ctx context.Context, tenantUUID string, isActive bool, adminUUID, callerTenantUUID string) (*models.Tenant, error) {
	if !isActive {
		if tenantUUID == callerTenantUUID {
			return nil, errCannotSuspendPlatformTenant
		}
		target, err := s.TenantRepo.GetFullTenantByUUID(ctx, tenantUUID)
		if err != nil {
			return nil, err
		}
		if target.ShortName != nil && *target.ShortName == database.PlatformTenantShortName {
			return nil, errCannotSuspendPlatformTenant
		}
	}

	tx, err := s.DB.Db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	tenant, err := s.TenantRepo.SetTenantActiveWithTX(ctx, tx, tenantUUID, isActive)
	if err != nil {
		return nil, err
	}

	event := events.CreateNewTenantStatusChanged(tenant, adminUUID)
	if err := s.EventRepo.SaveEventWithTx(ctx, tx, event.BaseEvent); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	s.TenantRepo.InvalidateTenantCaches(ctx, tenant)
	s.EventRepo.PublishAsync(event.BaseEvent)
	return tenant, nil
}

// tenantKYCDecisions are the outcomes an admin can record on a tenant KYC document.
var tenantKYCDecisions = map[string]bool{"VERIFIED": true, "REJECTED": true}

// Stage 5: KYC Add
func (s *TenantConfigService) UpdateTenantKYCAdd(ctx context.Context, kycDoc *models.TenantKYCDocument, adminUUID string, tenantUUID string) error {
	if kycDoc.DocumentType == "" || kycDoc.DocumentURL == "" {
		return invalidInput("tkd_document_type and tkd_document_url are required.")
	}
	tenantIntID, err := s.TenantRepo.TenantUUIDtoID(ctx, tenantUUID)
	if err != nil || tenantIntID == 0 {
		return fmt.Errorf("invalid tenant UUID: %w", err)
	}
	kycDoc.TenantID = tenantIntID
	// New documents always start pending review; the client doesn't choose.
	kycDoc.UUID = utility_functions.GenerateNewUUID()
	kycDoc.Status = "PENDING"
	kycDoc.VerifiedBy = ""

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

	if err := tx.Commit(); err != nil {
		return err
	}
	s.EventRepo.PublishAsync(auditEvent)
	return nil
}

// Stage 6: KYC Verify. kycDoc.Status is VERIFIED or REJECTED; kycDoc.VerifiedBy is the
// deciding admin's UUID.
func (s *TenantConfigService) UpdateTenantKYCVerify(ctx context.Context, kycDoc *models.TenantKYCDocument, adminUUID string, tenantUUID string) error {
	if !tenantKYCDecisions[kycDoc.Status] {
		return invalidInput("tkd_status must be VERIFIED or REJECTED.")
	}
	if kycDoc.UUID == "" {
		return invalidInput("tkd_uuid is required.")
	}
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

	if err := tx.Commit(); err != nil {
		return err
	}
	s.EventRepo.PublishAsync(auditEvent)
	return nil
}

func (s *TenantConfigService) UpdateTenantUILayout(ctx context.Context, tenantUUID string, uiConfig []interface{}, adminUUID string) error {
	tenantID, err := s.TenantRepo.TenantUUIDtoID(ctx, tenantUUID)
	if err != nil {
		return err
	}

	configBytes, err := json.Marshal(uiConfig)
	if err != nil {
		return err
	}

	tx, err := s.DB.Db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	tenant, err := s.TenantRepo.UpdateTenantUILayoutWithTX(ctx, tx, tenantID, configBytes)
	if err != nil {
		return err
	}

	// Saved with the layout, so the audit log can't miss a change (it used to be written
	// after the update, with no timestamp and its error ignored).
	auditEvent := events.CreateNewTenantUILayoutUpdated(uiConfig, adminUUID, tenantUUID)
	if err := s.EventRepo.SaveEventWithTx(ctx, tx, auditEvent); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return err
	}
	// /tenant/info serves the layout from the tenant cache.
	s.TenantRepo.InvalidateTenantCaches(ctx, tenant)
	s.EventRepo.PublishAsync(auditEvent)
	return nil
}

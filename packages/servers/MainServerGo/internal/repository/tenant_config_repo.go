package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/rpsoftech/DigiGold/MainServerGo/internal/models"
	utility_functions "github.com/rpsoftech/DigiGold/MainServerGo/utility/functions"
	"github.com/rpsoftech/DigiGold/MainServerGo/utility/postgres"
)

type TenantConfigRepository struct {
	DB        *postgres.PostgresDBStruct
	EventRepo *EventRepository

	// Prepared Statements
	stmtGetByTenantID *sql.Stmt
	stmtUpsertConfig  *sql.Stmt
}

var (
	tenantConfigRepoInstance *TenantConfigRepository
	tenantConfigRepoOnce     sync.Once
)

// GetTenantConfigRepository implements Thread-Safe Lazy Initialization
func GetTenantConfigRepository() *TenantConfigRepository {
	tenantConfigRepoOnce.Do(func() {
		db := postgres.GetPostgresDB()
		eventRepo := GetEventRepository()
		// 1. GET QUERY: Fetch strictly by the internal Tenant ID for fast worker lookups
		queryGet := `
			SELECT 
				tic_id, tic_uuid, tic_tenant_id, 
				tic_whatsapp_json, tic_payment_gateway_json, tic_webhook_json, 
				tic_created_at, tic_modified_at
			FROM tenant_internal_configs
			WHERE tic_tenant_id = $1`

		stmtGet, err := db.Db.Prepare(queryGet)
		if err != nil {
			panic(fmt.Sprintf("FATAL: Failed to prepare GetTenantConfigByTenantID: %v", err))
		}

		// 2. UPSERT QUERY: Insert if missing, Update if exists (Perfect for 1:1 relationships)
		queryUpsert := `
			INSERT INTO tenant_internal_configs (
				tic_uuid, tic_tenant_id, tic_whatsapp_json, tic_payment_gateway_json, tic_webhook_json
			) VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (tic_tenant_id) DO UPDATE SET 
				tic_whatsapp_json = EXCLUDED.tic_whatsapp_json,
				tic_payment_gateway_json = EXCLUDED.tic_payment_gateway_json,
				tic_webhook_json = EXCLUDED.tic_webhook_json,
				tic_modified_at = CURRENT_TIMESTAMP
			RETURNING tic_id, tic_uuid, tic_created_at, tic_modified_at`

		stmtUpsert, err := db.Db.Prepare(queryUpsert)
		if err != nil {
			panic(fmt.Sprintf("FATAL: Failed to prepare UpsertTenantConfig: %v", err))
		}

		tenantConfigRepoInstance = &TenantConfigRepository{
			DB:                db,
			EventRepo:         eventRepo,
			stmtGetByTenantID: stmtGet,
			stmtUpsertConfig:  stmtUpsert,
		}
	})
	return tenantConfigRepoInstance
}

// ==========================================
// READ OPERATIONS (Used heavily by Background Workers)
// ==========================================

func (r *TenantConfigRepository) GetConfigByTenantID(ctx context.Context, tenantID int64) (*models.TenantInternalConfig, error) {
	var config models.TenantInternalConfig
	var whatsappBytes, paymentBytes, webhookBytes []byte

	err := r.stmtGetByTenantID.QueryRowContext(ctx, tenantID).Scan(
		&config.ID, &config.UUID, &config.TenantID,
		&whatsappBytes, &paymentBytes, &webhookBytes,
		&config.CreatedAt, &config.ModifiedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			// Return a clean error if no config exists yet, allowing the worker to fallback to "DEFAULT"
			return nil, fmt.Errorf("tenant configuration not found")
		}
		return nil, err
	}

	// Unmarshal the raw JSONB bytes back into our strictly typed Go structs
	json.Unmarshal(whatsappBytes, &config.WhatsAppConfig)
	json.Unmarshal(paymentBytes, &config.PaymentConfig)
	json.Unmarshal(webhookBytes, &config.OthersConfig)

	return &config, nil
}

// ==========================================
// WRITE OPERATIONS (Used by Super Admin / Retail Admin Panels)
// ==========================================
// UpsertConfigWithTx executes the upsert strictly within an active database transaction
func (r *TenantConfigRepository) UpsertConfigWithTx(ctx context.Context, tx *sql.Tx, config *models.TenantInternalConfig) error {
	if config.UUID == "" {
		config.UUID = utility_functions.GenerateNewUUID()
	}

	whatsappBytes, _ := json.Marshal(config.WhatsAppConfig)
	paymentBytes, _ := json.Marshal(config.PaymentConfig)
	webhookBytes, _ := json.Marshal(config.OthersConfig)

	// CRITICAL: We execute the prepared statement USING THE TRANSACTION (tx.StmtContext)
	err := tx.StmtContext(ctx, r.stmtUpsertConfig).QueryRowContext(ctx,
		config.UUID,
		config.TenantID,
		whatsappBytes,
		paymentBytes,
		webhookBytes,
	).Scan(&config.ID, &config.UUID, &config.CreatedAt, &config.ModifiedAt)

	return err
}

package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/rpsoftech/DigiGold/MainServerGo/interfaces"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/models"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/schema"
	utility_functions "github.com/rpsoftech/DigiGold/MainServerGo/utility/functions"
	"github.com/rpsoftech/DigiGold/MainServerGo/utility/postgres"
	redis_client "github.com/rpsoftech/DigiGold/MainServerGo/utility/redis"
)

type TenantConfigRepository struct {
	DB        *postgres.PostgresDBStruct
	EventRepo *EventRepository
	Redis     *redis_client.RedisClientStruct

	// Prepared Statements
	stmtGetByTenantID   *sql.Stmt
	stmtGetByTenantUUID *sql.Stmt // ADDED: Pre-compiled statement for UUID lookups
	stmtUpsertConfig    *sql.Stmt
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
		rdb := redis_client.InitRedisClient()

		// 1. FULL QUERY BASE (Using Schema Constants)
		querySelectBase := fmt.Sprintf(`SELECT %s, %s, %s, %s, %s, %s, %s, %s FROM %s`,
			schema.ColTICId, schema.ColTICUUID, schema.ColTICTenantID,
			schema.ColTICWhatsappJSON, schema.ColTICPaymentGatewayJSON, schema.ColTICWebhookJSON,
			schema.ColTICCreatedAt, schema.ColTICModifiedAt,
			schema.TableTenantConfigs,
		)

		// GET BY TENANT ID
		stmtGet, err := db.Db.Prepare(fmt.Sprintf(`%s WHERE %s = $1`, querySelectBase, schema.ColTICTenantID))
		if err != nil {
			panic(fmt.Sprintf("FATAL: Failed to prepare GetTenantConfigByTenantID: %v", err))
		}

		// GET BY TENANT UUID (ADDED)
		stmtGetUUID, err := db.Db.Prepare(fmt.Sprintf(`%s WHERE %s = $1`, querySelectBase, schema.ColTICUUID))
		if err != nil {
			panic(fmt.Sprintf("FATAL: Failed to prepare GetTenantConfigByTenantUUID: %v", err))
		}

		// 2. UPSERT QUERY (Using Schema Constants)
		queryUpsert := fmt.Sprintf(`
            INSERT INTO %s (%s, %s, %s, %s, %s)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (%s) DO UPDATE SET 
                %s = EXCLUDED.%s,
                %s = EXCLUDED.%s,
                %s = EXCLUDED.%s,
                %s = CURRENT_TIMESTAMP
            RETURNING %s, %s, %s, %s`,
			schema.TableTenantConfigs, schema.ColTICUUID, schema.ColTICTenantID, schema.ColTICWhatsappJSON, schema.ColTICPaymentGatewayJSON, schema.ColTICWebhookJSON,
			schema.ColTICTenantID, // The conflict target
			schema.ColTICWhatsappJSON, schema.ColTICWhatsappJSON,
			schema.ColTICPaymentGatewayJSON, schema.ColTICPaymentGatewayJSON,
			schema.ColTICWebhookJSON, schema.ColTICWebhookJSON,
			schema.ColTICModifiedAt,
			schema.ColTICId, schema.ColTICUUID, schema.ColTICCreatedAt, schema.ColTICModifiedAt,
		)

		stmtUpsert, err := db.Db.Prepare(queryUpsert)
		if err != nil {
			panic(fmt.Sprintf("FATAL: Failed to prepare UpsertTenantConfig: %v", err))
		}

		tenantConfigRepoInstance = &TenantConfigRepository{
			DB:                  db,
			Redis:               rdb,
			EventRepo:           eventRepo,
			stmtGetByTenantID:   stmtGet,
			stmtGetByTenantUUID: stmtGetUUID,
			stmtUpsertConfig:    stmtUpsert,
		}
	})
	return tenantConfigRepoInstance
}

// ==========================================
// READ OPERATIONS
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
		if errors.Is(err, sql.ErrNoRows) {
			return nil, interfaces.ErrTenantConfigNotFound
		}
		return nil, err
	}

	json.Unmarshal(whatsappBytes, &config.WhatsAppConfig)
	json.Unmarshal(paymentBytes, &config.PaymentConfig)
	json.Unmarshal(webhookBytes, &config.OthersConfig)

	return &config, nil
}

// ==========================================
// WRITE OPERATIONS
// ==========================================
func (r *TenantConfigRepository) UpsertConfigWithTx(ctx context.Context, tx *sql.Tx, config *models.TenantInternalConfig) error {
	if config.UUID == "" {
		config.UUID = utility_functions.GenerateNewUUID()
	}

	whatsappBytes, _ := json.Marshal(config.WhatsAppConfig)
	paymentBytes, _ := json.Marshal(config.PaymentConfig)
	webhookBytes, _ := json.Marshal(config.OthersConfig)

	err := tx.StmtContext(ctx, r.stmtUpsertConfig).QueryRowContext(ctx,
		config.UUID,
		config.TenantID,
		whatsappBytes,
		paymentBytes,
		webhookBytes,
	).Scan(&config.ID, &config.UUID, &config.CreatedAt, &config.ModifiedAt)

	if err == nil {
		go func(uuid string) {
			bgCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			defer cancel()
			// FIXED: Guaranteeing the invalidation key matches the generation key
			cacheKey := fmt.Sprintf("tenant_config/%s", uuid)
			r.Redis.RemoveKey(bgCtx, cacheKey)
		}(config.UUID)
	}

	return err
}

func (r *TenantConfigRepository) GetConfigByTenantUUID(ctx context.Context, tenantUUID string) (*models.TenantInternalConfig, error) {
	// FIXED: Standardized the cache key formatting to match the Upsert function
	cacheKey := fmt.Sprintf("tenant_config:%s", tenantUUID)

	if cachedData, err := r.Redis.GetStringData(ctx, cacheKey); err == nil && cachedData != "" {
		var config models.TenantInternalConfig
		if err := json.Unmarshal([]byte(cachedData), &config); err == nil {
			return &config, nil
		}
	}

	var config models.TenantInternalConfig
	var whatsappBytes, paymentBytes, webhookBytes []byte

	// FIXED: Using the prepared statement instead of executing a live raw string
	err := r.stmtGetByTenantUUID.QueryRowContext(ctx, tenantUUID).Scan(
		&config.ID, &config.UUID, &config.TenantID,
		&whatsappBytes, &paymentBytes, &webhookBytes,
		&config.CreatedAt, &config.ModifiedAt,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, interfaces.ErrTenantConfigNotFound
		}
		return nil, err
	}

	json.Unmarshal(whatsappBytes, &config.WhatsAppConfig)
	json.Unmarshal(paymentBytes, &config.PaymentConfig)
	json.Unmarshal(webhookBytes, &config.OthersConfig)

	configBytes, _ := json.Marshal(config)
	r.Redis.SetStringDataWithExpiry(ctx, cacheKey, string(configBytes), 24*time.Hour)

	return &config, nil
}

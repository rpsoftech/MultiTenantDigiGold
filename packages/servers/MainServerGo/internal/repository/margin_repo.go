package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/rpsoftech/DigiGold/MainServerGo/internal/models"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/schema"
	"github.com/rpsoftech/DigiGold/MainServerGo/utility/postgres"
	redis_client "github.com/rpsoftech/DigiGold/MainServerGo/utility/redis"
)

var (
	marginRepoInstance *MarginRepository
	marginRepoOnce     sync.Once
)

type MarginRepository struct {
	DB                      *postgres.PostgresDBStruct
	Redis                   *redis_client.RedisClientStruct
	stmtGetMarginByTenant   *sql.Stmt
	stmtGetMarginForUpdate  *sql.Stmt
	stmtUpdateUnliftedGrams *sql.Stmt
	stmtCreateMargin        *sql.Stmt // NEW: For Stage 1 Bootstrapping
	stmtUpdateMargin        *sql.Stmt // NEW: For Stage 2 Admin Patching
}

func InitMarginRepository() *MarginRepository {
	marginRepoOnce.Do(func() {
		db := postgres.GetPostgresDB()
		rdb := redis_client.InitRedisClient()

		query := fmt.Sprintf(
			"SELECT %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s FROM %s WHERE %s = $1 AND %s = $2 AND %s = true LIMIT 1",
			schema.ColMCID,
			schema.ColMCUUID,
			schema.ColMCTenantID,
			schema.ColMCCommodityType,
			schema.ColMCSellMarginType,
			schema.ColMCSellMarginValue,
			schema.ColMCIsGSTEnabled,
			schema.ColMCGSTPercentage,
			schema.ColMCTenantCreditLimitGrams,
			schema.ColMCTenantUnliftedGrams,
			schema.ColMCIsActive,
			schema.ColMCCreatedAt,
			schema.ColMCModifiedAt,
			schema.TableMarginConfigs,
			schema.ColMCTenantID,
			schema.ColMCCommodityType,
			schema.ColMCIsActive,
		)

		stmt, err := db.Db.Prepare(query)
		if err != nil {
			panic(fmt.Errorf("error preparing stmtGetMarginByTenant: %w", err))
		}

		queryForUpdate := query + " FOR UPDATE"
		stmtForUpdate, err := db.Db.Prepare(queryForUpdate)
		if err != nil {
			panic(fmt.Errorf("error preparing stmtGetMarginForUpdate: %w", err))
		}

		queryUpdate := fmt.Sprintf(
			"UPDATE %s SET %s = $1, %s = NOW() WHERE %s = $2",
			schema.TableMarginConfigs,
			schema.ColMCTenantUnliftedGrams,
			schema.ColMCModifiedAt,
			schema.ColMCTenantID,
		)
		stmtUpdate, err := db.Db.Prepare(queryUpdate)
		if err != nil {
			panic(fmt.Errorf("error preparing stmtUpdateUnliftedGrams: %w", err))
		}

		// 1. Prepared Statement: Create Margin (Stage 1)
		queryCreate := fmt.Sprintf(`
    INSERT INTO %s (
        %s, %s, %s, %s, %s, %s, %s, %s, %s
    ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9
    ) RETURNING %s, %s, %s`,
			schema.TableMarginConfigs,
			schema.ColMCTenantID, schema.ColMCCommodityType, schema.ColMCSellMarginType,
			schema.ColMCSellMarginValue, schema.ColMCIsGSTEnabled, schema.ColMCGSTPercentage,
			schema.ColMCTenantCreditLimitGrams, schema.ColMCTenantUnliftedGrams, schema.ColMCIsActive,
			schema.ColMCID, schema.ColMCCreatedAt, schema.ColMCModifiedAt,
		)
		stmtCreate, err := db.Db.Prepare(queryCreate)
		if err != nil {
			panic(fmt.Errorf("error preparing stmtCreateMargin: %w", err))
		}

		// 2. Prepared Statement: Update Margin (Stage 2)
		queryUpdateAdmin := fmt.Sprintf(`
			UPDATE %s SET 
				%s = $1, %s = $2, %s = $3, %s = $4, %s = $5, %s = NOW()
			WHERE %s = $6 AND %s = $7
			RETURNING %s`,
			schema.TableMarginConfigs,
			schema.ColMCSellMarginType, schema.ColMCSellMarginValue,
			schema.ColMCIsGSTEnabled, schema.ColMCGSTPercentage, schema.ColMCTenantCreditLimitGrams,
			schema.ColMCModifiedAt,
			schema.ColMCTenantID, schema.ColMCCommodityType,
			schema.ColMCModifiedAt,
		)
		stmtUpdateAdmin, err := db.Db.Prepare(queryUpdateAdmin)
		if err != nil {
			panic(fmt.Errorf("error preparing stmtUpdateMargin: %w", err))
		}
		marginRepoInstance = &MarginRepository{
			DB:                      db,
			Redis:                   rdb,
			stmtGetMarginByTenant:   stmt,
			stmtGetMarginForUpdate:  stmtForUpdate,
			stmtUpdateUnliftedGrams: stmtUpdate,
			stmtCreateMargin:        stmtCreate,
			stmtUpdateMargin:        stmtUpdateAdmin,
		}
	})
	return marginRepoInstance
}

// GetMarginByTenant retrieves margin properties for a tenant
func (r *MarginRepository) GetMarginByTenant(ctx context.Context, tenantID int64, commodityType string) (*models.MarginConfig, error) {
	cacheKey := fmt.Sprintf("cache:tenant:%d:margin:%s", tenantID, commodityType)

	// 1. Check Redis Cache
	cachedData, err := r.Redis.GetStringData(ctx, cacheKey)
	if err == nil && cachedData != "" {
		var margin models.MarginConfig
		if err := json.Unmarshal([]byte(cachedData), &margin); err == nil {
			return &margin, nil
		}
	}

	// 2. Cache Miss: Hit DB
	var margin models.MarginConfig

	err = r.stmtGetMarginByTenant.QueryRowContext(ctx, tenantID, commodityType).Scan(
		&margin.ID,
		&margin.UUID,
		&margin.TenantID,
		&margin.CommodityType,
		&margin.SellMarginType,
		&margin.SellMarginValue,
		&margin.IsGSTEnabled,
		&margin.GSTPercentage,
		&margin.TenantCreditLimitGrams,
		&margin.TenantUnLiftedGrams,
		&margin.IsActive,
		&margin.CreatedAt,
		&margin.ModifiedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("margin configuration not found")
		}
		return nil, err
	}

	// 3. Asynchronously push to Redis
	go func(m models.MarginConfig) {
		bgCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		r.updateCache(bgCtx, tenantID, commodityType, &m)
	}(margin)

	return &margin, nil
}

func (r *MarginRepository) createCacheKey(tenantID int64, commodityType string) string {
	return fmt.Sprintf("cache:tenant:%d:margin:%s", tenantID, commodityType)
}

func (r *MarginRepository) updateCache(ctx context.Context, tenantID int64, commodityType string, m *models.MarginConfig) {
	jsonData, err := json.Marshal(m)
	if err == nil {
		_ = r.Redis.SetStringDataWithExpiry(ctx, r.createCacheKey(tenantID, commodityType), string(jsonData), 24*time.Hour)
	}
}

// IncrementUnliftedGramsWithTx locks the margin config and increases the unlifted grams
func (r *MarginRepository) IncrementUnliftedGramsWithTx(ctx context.Context, tx *sql.Tx, tenantID int64, commodityType string, tradeWeight float64) error {
	var margin models.MarginConfig

	err := tx.StmtContext(ctx, r.stmtGetMarginForUpdate).QueryRowContext(ctx, tenantID, commodityType).Scan(
		&margin.ID,
		&margin.UUID,
		&margin.TenantID,
		&margin.CommodityType,
		&margin.SellMarginType,
		&margin.SellMarginValue,
		&margin.IsGSTEnabled,
		&margin.GSTPercentage,
		&margin.TenantCreditLimitGrams,
		&margin.TenantUnLiftedGrams,
		&margin.IsActive,
		&margin.CreatedAt,
		&margin.ModifiedAt,
	)

	if err != nil {
		return fmt.Errorf("failed to lock margin config: %w", err)
	}

	newUnliftedGrams := margin.TenantUnLiftedGrams + tradeWeight
	if newUnliftedGrams > margin.TenantCreditLimitGrams {
		return fmt.Errorf("B2B_CREDIT_EXCEEDED: trade of %f grams exceeds available capacity", tradeWeight)
	}

	_, err = tx.StmtContext(ctx, r.stmtUpdateUnliftedGrams).ExecContext(ctx, newUnliftedGrams, margin.ID)
	if err != nil {
		return fmt.Errorf("failed to update unlifted grams: %w", err)
	}

	// Invalidate cache asynchronously
	go func() {
		bgCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		r.updateCache(bgCtx, tenantID, commodityType, &margin)
	}()

	return nil
}

// CreateMarginConfigWithTx inserts a new margin configuration atomically
func (r *MarginRepository) CreateMarginConfigWithTx(ctx context.Context, tx *sql.Tx, margin *models.MarginConfig) error {
	// Zero Magic Strings & Strict Prepared Statement usage
	err := tx.StmtContext(ctx, r.stmtCreateMargin).QueryRowContext(ctx,
		margin.TenantID, margin.CommodityType, margin.SellMarginType,
		margin.SellMarginValue, margin.IsGSTEnabled, margin.GSTPercentage,
		margin.TenantCreditLimitGrams, margin.TenantUnLiftedGrams, margin.IsActive,
	).Scan(&margin.ID, &margin.CreatedAt, &margin.ModifiedAt)

	if err != nil {
		return fmt.Errorf("failed to create margin config: %w", err)
	}
	return nil
}

// UpdateMarginConfigWithTx updates limits and margins via Master Admin API
func (r *MarginRepository) UpdateMarginConfigWithTx(ctx context.Context, tx *sql.Tx, margin *models.MarginConfig) error {
	err := tx.StmtContext(ctx, r.stmtUpdateMargin).QueryRowContext(ctx,
		margin.SellMarginType, margin.SellMarginValue,
		margin.IsGSTEnabled, margin.GSTPercentage, margin.TenantCreditLimitGrams,
		margin.TenantID, margin.CommodityType,
	).Scan(&margin.ModifiedAt)

	if err != nil {
		return fmt.Errorf("failed to update margin config: %w", err)
	}

	// Cache Invalidation (Strict Delete)
	go func() {
		bgCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		cacheKey := r.createCacheKey(margin.TenantID, margin.CommodityType)
		r.Redis.RemoveKey(bgCtx, cacheKey)
	}()

	return nil
}

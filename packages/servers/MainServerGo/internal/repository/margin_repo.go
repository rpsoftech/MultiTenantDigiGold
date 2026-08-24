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
	DB                    *postgres.PostgresDBStruct
	Redis                 *redis_client.RedisClientStruct
	stmtGetMarginByTenant *sql.Stmt
}

func InitMarginRepository() *MarginRepository {
	marginRepoOnce.Do(func() {
		db := postgres.GetPostgresDB()
		rdb := redis_client.InitRedisClient()

		query := fmt.Sprintf(
			"SELECT %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s FROM %s WHERE %s = $1 AND %s = $2 AND %s = true LIMIT 1",
			schema.ColMCID,
			schema.ColMCUUID,
			schema.ColMCTenantID,
			schema.ColMCCommodityType,
			schema.ColMCSellMarginType,
			schema.ColMCSellMarginValue,
			schema.ColMCIsGSTEnabled,
			schema.ColMCGSTPercentage,
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

		marginRepoInstance = &MarginRepository{
			DB:                    db,
			Redis:                 rdb,
			stmtGetMarginByTenant: stmt,
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

	// 3. Asynchronously push to Redis with TTL (24 hours)
	go func(m models.MarginConfig) {
		bgCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		jsonData, err := json.Marshal(m)
		if err == nil {
			_ = r.Redis.SetStringDataWithExpiry(bgCtx, cacheKey, string(jsonData), 24*time.Hour)
		}
	}(margin)

	return &margin, nil
}

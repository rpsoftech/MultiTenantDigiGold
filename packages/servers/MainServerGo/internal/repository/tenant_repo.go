package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"packages/servers/MainServerGo/interfaces"
	"packages/servers/MainServerGo/internal/models"
	"packages/servers/MainServerGo/internal/schema"
	"packages/servers/MainServerGo/utility/postgres"
	redis_client "packages/servers/MainServerGo/utility/redis"
)

type TenantRepository struct {
	DB    *postgres.PostgresDBStruct
	Redis *redis_client.RedisClientStruct

	// Partial Statements (8 Columns - Highly Optimized)
	stmtGetPartialByUUID   *sql.Stmt
	stmtGetPartialByDomain *sql.Stmt
	stmtGetPartialByShort  *sql.Stmt

	// Full Statements (14 Columns)
	stmtGetFullByUUID   *sql.Stmt
	stmtGetFullByDomain *sql.Stmt
	stmtGetFullByShort  *sql.Stmt

	// Write Statements
	stmtCreateTenant *sql.Stmt
	stmtUpdateTenant *sql.Stmt

	tenantCacheKeys *TenantRepoCacheKeys
	tenantUUIDtoID  map[string]int64
}

type TenantRepoCacheKeys struct {
	FullUUID   string
	FullDomain string
	FullShort  string
}

var (
	tenantRepoInstance *TenantRepository
	tenantRepoOnce     sync.Once
)

const tenantCacheTTL = time.Minute * 30

// GetTenantRepository implements Thread-Safe Lazy Initialization
func GetTenantRepository() *TenantRepository {
	tenantRepoOnce.Do(func() {
		db := postgres.GetPostgresDB()
		rdb := redis_client.InitRedisClient()

		// ==========================================
		// 1. PARTIAL QUERIES (8 Columns)
		// ==========================================
		queryPartialSelect := fmt.Sprintf(`
			SELECT %s, %s, %s, %s, %s, %s, %s, %s 
			FROM %s`,
			schema.ColTenantID, schema.ColTenantUUID, schema.ColTenantDomain, schema.ColTenantSubdomain,
			schema.ColTenantFullName, schema.ColTenantKYCMode, schema.ColTenantMarkupPercentage, schema.ColTenantUIJSONConfig,
			schema.TableTenants,
		)

		stmtPartialUUID, err := db.Db.Prepare(fmt.Sprintf(`%s WHERE %s = $1`, queryPartialSelect, schema.ColTenantUUID))
		if err != nil {
			panic(fmt.Sprintf("FATAL: Failed to prepare GetPartialTenantByUUID: %v", err))
		}

		stmtPartialDomain, err := db.Db.Prepare(fmt.Sprintf(`%s WHERE %s = $1`, queryPartialSelect, schema.ColTenantDomain))
		if err != nil {
			panic(fmt.Sprintf("FATAL: Failed to prepare GetPartialTenantByDomain: %v", err))
		}

		stmtPartialShort, err := db.Db.Prepare(fmt.Sprintf(`%s WHERE %s = $1`, queryPartialSelect, schema.ColTenantShortName))
		if err != nil {
			panic(fmt.Sprintf("FATAL: Failed to prepare GetPartialTenantByShortName: %v", err))
		}

		// ==========================================
		// 2. FULL QUERIES (14 Columns)
		// ==========================================
		queryFullSelect := fmt.Sprintf(`
			SELECT 
				%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s 
			FROM %s`,
			schema.ColTenantID, schema.ColTenantUUID, schema.ColTenantFullName, schema.ColTenantShortName,
			schema.ColTenantDomain, schema.ColTenantSubdomain, schema.ColTenantDomainExpiry, schema.ColTenantPlanExpiry,
			schema.ColTenantRenewalCost, schema.ColTenantKYCMode, schema.ColTenantMarkupPercentage, schema.ColTenantUIJSONConfig,
			schema.ColTenantCreatedAt, schema.ColTenantModifiedAt,
			schema.TableTenants,
		)

		stmtFullUUID, err := db.Db.Prepare(fmt.Sprintf(`%s WHERE %s = $1`, queryFullSelect, schema.ColTenantUUID))
		if err != nil {
			panic(fmt.Sprintf("FATAL: Failed to prepare GetFullTenantByUUID: %v", err))
		}

		stmtFullDomain, err := db.Db.Prepare(fmt.Sprintf(`%s WHERE %s = $1`, queryFullSelect, schema.ColTenantDomain))
		if err != nil {
			panic(fmt.Sprintf("FATAL: Failed to prepare GetFullTenantByDomain: %v", err))
		}

		stmtFullShort, err := db.Db.Prepare(fmt.Sprintf(`%s WHERE %s = $1`, queryFullSelect, schema.ColTenantShortName))
		if err != nil {
			panic(fmt.Sprintf("FATAL: Failed to prepare GetFullTenantByShortName: %v", err))
		}

		// ==========================================
		// 3. WRITE QUERIES
		// ==========================================
		queryCreate := fmt.Sprintf(`
			INSERT INTO %s (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
			RETURNING %s, %s, %s`,
			schema.TableTenants,
			schema.ColTenantUUID, schema.ColTenantFullName, schema.ColTenantShortName, schema.ColTenantDomain,
			schema.ColTenantSubdomain, schema.ColTenantDomainExpiry, schema.ColTenantPlanExpiry, schema.ColTenantRenewalCost,
			schema.ColTenantKYCMode, schema.ColTenantMarkupPercentage, schema.ColTenantUIJSONConfig,
			schema.ColTenantID, schema.ColTenantCreatedAt, schema.ColTenantModifiedAt,
		)
		stmtCreate, err := db.Db.Prepare(queryCreate)
		if err != nil {
			panic(fmt.Sprintf("FATAL: Failed to prepare CreateTenant: %v", err))
		}

		queryUpdate := fmt.Sprintf(`
			UPDATE %s SET 
				%s = $1, %s = $2, %s = $3, %s = $4, %s = $5, 
				%s = $6, %s = $7, %s = $8, %s = $9, %s = $10, 
				%s = CURRENT_TIMESTAMP
			WHERE %s = $11
			RETURNING %s`,
			schema.TableTenants,
			schema.ColTenantFullName, schema.ColTenantShortName, schema.ColTenantDomain, schema.ColTenantSubdomain,
			schema.ColTenantDomainExpiry, schema.ColTenantPlanExpiry, schema.ColTenantRenewalCost, schema.ColTenantKYCMode,
			schema.ColTenantMarkupPercentage, schema.ColTenantUIJSONConfig,
			schema.ColTenantModifiedAt,
			schema.ColTenantUUID,
			schema.ColTenantModifiedAt,
		)
		stmtUpdate, err := db.Db.Prepare(queryUpdate)
		if err != nil {
			panic(fmt.Sprintf("FATAL: Failed to prepare UpdateTenant: %v", err))
		}

		tenantRepoInstance = &TenantRepository{
			DB:                     db,
			Redis:                  rdb,
			stmtGetPartialByUUID:   stmtPartialUUID,
			stmtGetPartialByDomain: stmtPartialDomain,
			stmtGetPartialByShort:  stmtPartialShort,
			stmtGetFullByUUID:      stmtFullUUID,
			stmtGetFullByDomain:    stmtFullDomain,
			stmtGetFullByShort:     stmtFullShort,
			stmtCreateTenant:       stmtCreate,
			stmtUpdateTenant:       stmtUpdate,
			tenantUUIDtoID:         make(map[string]int64),
			tenantCacheKeys: &TenantRepoCacheKeys{
				FullUUID:   fmt.Sprintf("tenant/full/%s/", schema.ColTenantUUID),
				FullDomain: fmt.Sprintf("tenant/full/%s/", schema.ColTenantDomain),
				FullShort:  fmt.Sprintf("tenant/full/%s/", schema.ColTenantShortName),
			},
		}
	})
	return tenantRepoInstance
}

// ==========================================
// INTERNAL CACHE HELPERS
// ==========================================

func (r *TenantRepository) generateCacheKey(t *models.Tenant) []string {
	// Pre-allocate a slice with a capacity of 3 to avoid reallocation overhead during append
	keys := make([]string, 0, 3)

	keys = append(keys, r.Redis.GetRedisKey(r.tenantCacheKeys.FullUUID+t.UUID))

	if t.Domain != nil && *t.Domain != "" {
		keys = append(keys, r.Redis.GetRedisKey(r.tenantCacheKeys.FullDomain+*t.Domain))
	}
	if t.ShortName != nil && *t.ShortName != "" {
		keys = append(keys, r.Redis.GetRedisKey(r.tenantCacheKeys.FullShort+*t.ShortName))
	}

	return keys
}

func (r *TenantRepository) invalidateTenantCaches(ctx context.Context, t *models.Tenant) {
	keys := r.generateCacheKey(t)
	r.Redis.RemoveKey(ctx, keys...)
}

func (r *TenantRepository) createTenantCaches(ctx context.Context, t *models.Tenant) {
	keys := r.generateCacheKey(t)
	if jsonData, err := json.Marshal(t); err == nil {
		for _, cacheKey := range keys {
			r.Redis.SetStringDataWithExpiry(ctx, cacheKey, string(jsonData), tenantCacheTTL)
		}
	}
}

// ==========================================
// INTERNAL SCAN HELPERS
// ==========================================

func (r *TenantRepository) scanPartialRetrieval(row *sql.Row) (*models.Tenant, error) {
	var t models.Tenant
	err := row.Scan(
		&t.ID, &t.UUID, &t.Domain, &t.Subdomain,
		&t.FullName, &t.KYCMode, &t.MarkupPercentage, &t.UIJSONConfig,
	)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *TenantRepository) scanFullRetrieval(row *sql.Row) (*models.Tenant, error) {
	var t models.Tenant
	err := row.Scan(
		&t.ID, &t.UUID, &t.FullName, &t.ShortName,
		&t.Domain, &t.Subdomain, &t.DomainExpiry, &t.PlanExpiry,
		&t.RenewalCost, &t.KYCMode, &t.MarkupPercentage, &t.UIJSONConfig,
		&t.CreatedAt, &t.ModifiedAt,
	)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *TenantRepository) TenantUUIDtoID(ctx context.Context, uuid string) (*int64, error) {
	id, ok := r.tenantUUIDtoID[uuid]
	if !ok {
		entity, err := r.GetFullTenantByUUID(ctx, uuid)
		if err != nil {
			return nil, err
		}
		id = entity.ID
		r.tenantUUIDtoID[uuid] = id
	}
	return &id, nil
}

// ==========================================
// WRITE OPERATIONS
// ==========================================

func (r *TenantRepository) CreateFullTenant(ctx context.Context, t *models.Tenant) error {
	err := r.stmtCreateTenant.QueryRowContext(ctx,
		t.UUID, t.FullName, t.ShortName, t.Domain, t.Subdomain,
		t.DomainExpiry, t.PlanExpiry, t.RenewalCost, t.KYCMode,
		t.MarkupPercentage, t.UIJSONConfig,
	).Scan(&t.ID, &t.CreatedAt, &t.ModifiedAt)

	if err != nil {
		return err
	}

	go r.createTenantCaches(context.Background(), t)
	return nil
}

func (r *TenantRepository) UpdateFullTenant(ctx context.Context, t *models.Tenant) error {
	err := r.stmtUpdateTenant.QueryRowContext(ctx,
		t.FullName, t.ShortName, t.Domain, t.Subdomain,
		t.DomainExpiry, t.PlanExpiry, t.RenewalCost, t.KYCMode,
		t.MarkupPercentage, t.UIJSONConfig,
		t.UUID,
	).Scan(&t.ModifiedAt)

	if err != nil {
		return err
	}

	go r.invalidateTenantCaches(context.Background(), t)
	return nil
}

// ==========================================
// READ OPERATIONS (FULL ENTITY)
// ==========================================

func (r *TenantRepository) GetFullTenantByUUID(ctx context.Context, uuid string) (*models.Tenant, error) {
	cacheKey := r.Redis.GetRedisKey(r.tenantCacheKeys.FullUUID + uuid)

	cachedStr, err := r.Redis.GetStringData(ctx, cacheKey)
	if err == nil && cachedStr != "" {
		var t models.Tenant
		if marshalErr := json.Unmarshal([]byte(cachedStr), &t); marshalErr == nil {
			return &t, nil
		}
	}

	t, err := r.scanFullRetrieval(r.stmtGetFullByUUID.QueryRowContext(ctx, uuid))
	if err != nil {
		return nil, interfaces.ErrTenantNotFound
	}

	go r.createTenantCaches(context.Background(), t)
	return t, nil
}

func (r *TenantRepository) GetFullTenantByShortName(ctx context.Context, shortName string) (*models.Tenant, error) {
	cacheKey := r.Redis.GetRedisKey(r.tenantCacheKeys.FullShort + shortName)

	cachedStr, err := r.Redis.GetStringData(ctx, cacheKey)
	if err == nil && cachedStr != "" {
		var t models.Tenant
		if marshalErr := json.Unmarshal([]byte(cachedStr), &t); marshalErr == nil {
			return &t, nil
		}
	}

	t, err := r.scanFullRetrieval(r.stmtGetFullByShort.QueryRowContext(ctx, shortName))
	if err != nil {
		return nil, interfaces.ErrTenantNotFound
	}

	go r.createTenantCaches(context.Background(), t)
	return t, nil
}

func (r *TenantRepository) GetFullTenantByDomain(ctx context.Context, domain string) (*models.Tenant, error) {
	cacheKey := r.Redis.GetRedisKey(r.tenantCacheKeys.FullDomain + domain)
	cachedStr, err := r.Redis.GetStringData(ctx, cacheKey)
	if err == nil && cachedStr != "" {
		var t models.Tenant
		if marshalErr := json.Unmarshal([]byte(cachedStr), &t); marshalErr == nil {
			return &t, nil
		}
	}

	t, err := r.scanFullRetrieval(r.stmtGetFullByDomain.QueryRowContext(ctx, domain))
	if err != nil {
		return nil, interfaces.ErrTenantNotFound
	}

	go r.createTenantCaches(context.Background(), t)
	return t, nil
}

// ==========================================
// READ OPERATIONS (PARTIAL ENTITY)
// ==========================================

func (r *TenantRepository) GetPartialTenantByUUID(ctx context.Context, uuid string) (*models.Tenant, error) {
	cacheKey := r.Redis.GetRedisKey(r.tenantCacheKeys.FullUUID + uuid)

	cachedStr, err := r.Redis.GetStringData(ctx, cacheKey)
	if err == nil && cachedStr != "" {
		var t models.Tenant
		if marshalErr := json.Unmarshal([]byte(cachedStr), &t); marshalErr == nil {
			return &t, nil
		}
	}

	t, err := r.scanPartialRetrieval(r.stmtGetPartialByUUID.QueryRowContext(ctx, uuid))
	if err != nil {
		return nil, err
	}
	return t, nil
}

func (r *TenantRepository) GetPartialTenantByDomain(ctx context.Context, domain string) (*models.Tenant, error) {
	cacheKey := r.Redis.GetRedisKey(r.tenantCacheKeys.FullDomain + domain)

	cachedStr, err := r.Redis.GetStringData(ctx, cacheKey)
	if err == nil && cachedStr != "" {
		var t models.Tenant
		if marshalErr := json.Unmarshal([]byte(cachedStr), &t); marshalErr == nil {
			return &t, nil
		}
	}

	t, err := r.scanPartialRetrieval(r.stmtGetPartialByDomain.QueryRowContext(ctx, domain))
	if err != nil {
		return nil, err
	}
	return t, nil
}

func (r *TenantRepository) GetPartialTenantByShortName(ctx context.Context, shortName string) (*models.Tenant, error) {
	cacheKey := r.Redis.GetRedisKey(r.tenantCacheKeys.FullShort + shortName)

	cachedStr, err := r.Redis.GetStringData(ctx, cacheKey)
	if err == nil && cachedStr != "" {
		var t models.Tenant
		if marshalErr := json.Unmarshal([]byte(cachedStr), &t); marshalErr == nil {
			return &t, nil
		}
	}

	t, err := r.scanPartialRetrieval(r.stmtGetPartialByShort.QueryRowContext(ctx, shortName))
	if err != nil {
		return nil, err
	}
	return t, nil
}

package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/rpsoftech/DigiGold/MainServerGo/interfaces"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/models"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/schema"
	"github.com/rpsoftech/DigiGold/MainServerGo/utility/postgres"
	redis_client "github.com/rpsoftech/DigiGold/MainServerGo/utility/redis"
)

type TenantRepository struct {
	DB    *postgres.PostgresDBStruct
	Redis *redis_client.RedisClientStruct
	// EventRepo *EventRepository
	// Partial Statements (8 Columns - Highly Optimized)
	stmtGetPartialByUUID   *sql.Stmt
	stmtGetPartialByDomain *sql.Stmt
	stmtGetPartialByShort  *sql.Stmt

	// Full Statements (14 Columns)
	stmtGetFullByUUID   *sql.Stmt
	stmtGetFullByDomain *sql.Stmt
	stmtGetFullByShort  *sql.Stmt
	stmtGetAllTenants   *sql.Stmt
	stmtCountAllTenants *sql.Stmt

	// Write Statements
	stmtCreateTenant *sql.Stmt
	stmtUpdateTenant *sql.Stmt
	stmtSetActive    *sql.Stmt

	tenantCacheKeys *TenantRepoCacheKeys
	// A tenant's internal ID never changes, so this mapping is kept for the process lifetime.
	tenantUUIDtoID map[string]int64
	uuidMapMutex   sync.RWMutex
	// Whether a tenant is active can change, so request handling re-reads it after
	// activeTenantTTL (see ResolveActiveTenantID).
	activeTenants   map[string]activeTenantEntry
	activeTenantsMu sync.RWMutex
}

type activeTenantEntry struct {
	id        int64
	active    bool
	checkedAt time.Time
}

// activeTenantTTL bounds how long another API instance keeps serving a store that was just
// suspended (or refusing one that was just reactivated).
const activeTenantTTL = 30 * time.Second

// fullTenantColumns is the column list every full tenant read selects, in scanFullRetrieval order.
var fullTenantColumns = strings.Join([]string{
	schema.ColTenantID, schema.ColTenantUUID, schema.ColTenantFullName, schema.ColTenantShortName,
	schema.ColTenantDomain, schema.ColTenantSubdomain, schema.ColTenantDomainExpiry, schema.ColTenantPlanExpiry,
	schema.ColTenantRenewalCost, schema.ColTenantKYCMode, schema.ColTenantMarkupPercentage, schema.ColTenantUIJSONConfig,
	schema.ColTenantIsActive, schema.ColTenantCreatedAt, schema.ColTenantModifiedAt,
}, ", ")

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
		// eventRepo := GetEventRepository()
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
				%s
			FROM %s`,
			fullTenantColumns,
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

		stmtGetAllTenants, err := db.Db.Prepare(fmt.Sprintf(`%s ORDER BY %s DESC LIMIT $1 OFFSET $2`, queryFullSelect, schema.ColTenantCreatedAt))
		if err != nil {
			panic(fmt.Sprintf("FATAL: Failed to prepare GetAllTenants: %v", err))
		}

		stmtCountAllTenants, err := db.Db.Prepare(fmt.Sprintf(`SELECT COUNT(*) FROM %s`, schema.TableTenants))
		if err != nil {
			panic(fmt.Sprintf("FATAL: Failed to prepare CountAllTenants: %v", err))
		}

		// ==========================================
		// 3. WRITE QUERIES
		// ==========================================
		queryCreate := fmt.Sprintf(`
			INSERT INTO %s (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
			RETURNING %s, %s, %s, %s`,
			schema.TableTenants,
			schema.ColTenantUUID, schema.ColTenantFullName, schema.ColTenantShortName, schema.ColTenantDomain,
			schema.ColTenantSubdomain, schema.ColTenantDomainExpiry, schema.ColTenantPlanExpiry, schema.ColTenantRenewalCost,
			schema.ColTenantKYCMode, schema.ColTenantMarkupPercentage, schema.ColTenantUIJSONConfig,
			schema.ColTenantID, schema.ColTenantIsActive, schema.ColTenantCreatedAt, schema.ColTenantModifiedAt,
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

		stmtSetActive, err := db.Db.Prepare(fmt.Sprintf(
			`UPDATE %s SET %s = $1, %s = CURRENT_TIMESTAMP WHERE %s = $2 RETURNING %s`,
			schema.TableTenants, schema.ColTenantIsActive, schema.ColTenantModifiedAt, schema.ColTenantUUID,
			fullTenantColumns,
		))
		if err != nil {
			panic(fmt.Sprintf("FATAL: Failed to prepare SetTenantActive: %v", err))
		}

		tenantRepoInstance = &TenantRepository{
			DB:    db,
			Redis: rdb,
			// EventRepo:              eventRepo,
			stmtGetPartialByUUID:   stmtPartialUUID,
			stmtGetPartialByDomain: stmtPartialDomain,
			stmtGetPartialByShort:  stmtPartialShort,
			stmtGetFullByUUID:      stmtFullUUID,
			stmtGetFullByDomain:    stmtFullDomain,
			stmtGetFullByShort:     stmtFullShort,
			stmtGetAllTenants:      stmtGetAllTenants,
			stmtCountAllTenants:    stmtCountAllTenants,
			stmtCreateTenant:       stmtCreate,
			stmtUpdateTenant:       stmtUpdate,
			stmtSetActive:          stmtSetActive,
			tenantUUIDtoID:         make(map[string]int64),
			activeTenants:          make(map[string]activeTenantEntry),
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

	keys = append(keys, r.tenantCacheKeys.FullUUID+t.UUID)

	if t.Domain != nil && *t.Domain != "" {
		keys = append(keys, r.tenantCacheKeys.FullDomain+*t.Domain)
	}
	if t.ShortName != nil && *t.ShortName != "" {
		keys = append(keys, r.tenantCacheKeys.FullShort+*t.ShortName)
	}

	return keys
}

// InvalidateTenantCaches drops a tenant's cached rows (by UUID, domain and short name) and
// this instance's active-status entry. Call it after the transaction that changed the tenant
// commits: dropping the cache earlier lets a concurrent read cache the old row again.
func (r *TenantRepository) InvalidateTenantCaches(ctx context.Context, t *models.Tenant) {
	timeoutCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	keys := r.generateCacheKey(t)
	r.Redis.RemoveKey(timeoutCtx, keys...)

	r.activeTenantsMu.Lock()
	delete(r.activeTenants, t.UUID)
	r.activeTenantsMu.Unlock()
}

func (r *TenantRepository) readCachedData(ctx context.Context, key string) *models.Tenant {
	cachedStr, err := r.Redis.GetStringData(ctx, key)
	if err == nil && cachedStr != "" {
		var t models.Tenant
		if marshalErr := json.Unmarshal([]byte(cachedStr), &t); marshalErr == nil {
			t.ID = t.ExportID
			t.ExportID = 0 // Never echo the internal ID in a response.
			return &t
		}
	}
	return nil
}

// createTenantCaches caches a copy of t: callers may be serialising t to a response at the
// same time, so it must not be modified here. Reads call it before returning, not in a
// goroutine: a write that lands after a later update's invalidation would cache the old row
// for tenantCacheTTL.
func (r *TenantRepository) createTenantCaches(ctx context.Context, t *models.Tenant) {
	timeoutCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	cached := *t
	cached.ExportID = t.ID
	keys := r.generateCacheKey(&cached)
	if jsonData, err := json.Marshal(&cached); err == nil {
		for _, cacheKey := range keys {
			r.Redis.SetStringDataWithExpiry(timeoutCtx, cacheKey, string(jsonData), tenantCacheTTL)
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
		&t.IsActive, &t.CreatedAt, &t.ModifiedAt,
	)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// ResolveActiveTenantID maps a tenant UUID to its internal ID for request handling and
// refuses a suspended tenant with ErrTenantInactive. The answer is kept for activeTenantTTL,
// so a suspension reaches every API instance within that time. Use TenantUUIDtoID where a
// suspended tenant must still be reachable (platform admin edits, reactivation).
//
// It reads the database, not the Redis row cache: a cached row can be stale for
// tenantCacheTTL (a read that raced the suspension can cache the active row again after the
// invalidation), and a stale row must not keep a suspended store open.
func (r *TenantRepository) ResolveActiveTenantID(ctx context.Context, uuid string) (int64, error) {
	r.activeTenantsMu.RLock()
	entry, ok := r.activeTenants[uuid]
	r.activeTenantsMu.RUnlock()

	if !ok || time.Since(entry.checkedAt) > activeTenantTTL {
		t, err := r.scanFullRetrieval(r.stmtGetFullByUUID.QueryRowContext(ctx, uuid))
		if errors.Is(err, sql.ErrNoRows) {
			return 0, interfaces.ErrTenantNotFound
		}
		if err != nil {
			return 0, err
		}
		entry = activeTenantEntry{id: t.ID, active: t.IsActive, checkedAt: time.Now()}
		r.activeTenantsMu.Lock()
		// Copy the key: uuid comes from a request header, and Fiber reuses that memory for
		// later requests, which would change the key in place (lookups then miss or hit the
		// wrong entry, and InvalidateTenantCaches can't delete it).
		r.activeTenants[strings.Clone(uuid)] = entry
		r.activeTenantsMu.Unlock()
	}
	if !entry.active {
		return 0, interfaces.ErrTenantInactive
	}
	return entry.id, nil
}

// SetTenantActiveWithTX suspends or reactivates a tenant and returns the updated row. The
// caller invalidates the tenant's caches after commit (InvalidateTenantCaches).
func (r *TenantRepository) SetTenantActiveWithTX(ctx context.Context, tx *sql.Tx, uuid string, active bool) (*models.Tenant, error) {
	t, err := r.scanFullRetrieval(tx.StmtContext(ctx, r.stmtSetActive).QueryRowContext(ctx, active, uuid))
	if errors.Is(err, sql.ErrNoRows) {
		return nil, interfaces.ErrTenantNotFound
	}
	return t, err
}

func (r *TenantRepository) TenantUUIDtoID(ctx context.Context, uuid string) (int64, error) {
	r.uuidMapMutex.RLock()
	id, ok := r.tenantUUIDtoID[uuid]
	r.uuidMapMutex.RUnlock()
	if !ok {
		entity, err := r.GetFullTenantByUUID(ctx, uuid)
		if err != nil {
			return 0, err
		}
		id = entity.ID
		r.uuidMapMutex.Lock()
		r.tenantUUIDtoID[strings.Clone(uuid)] = id // copied: see ResolveActiveTenantID
		r.uuidMapMutex.Unlock()

	}
	return id, nil
}

func (r *TenantRepository) GetAllTenantsPaginated(ctx context.Context, limit, offset int) ([]*models.Tenant, int64, error) {
	var total int64
	err := r.stmtCountAllTenants.QueryRowContext(ctx).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count tenants: %w", err)
	}

	rows, err := r.stmtGetAllTenants.QueryContext(ctx, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query tenants: %w", err)
	}
	defer rows.Close()

	var tenants []*models.Tenant
	for rows.Next() {
		var t models.Tenant
		if err := rows.Scan(
			&t.ID, &t.UUID, &t.FullName, &t.ShortName,
			&t.Domain, &t.Subdomain, &t.DomainExpiry, &t.PlanExpiry,
			&t.RenewalCost, &t.KYCMode, &t.MarkupPercentage, &t.UIJSONConfig,
			&t.IsActive, &t.CreatedAt, &t.ModifiedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("failed to scan tenant: %w", err)
		}
		tenants = append(tenants, &t)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("rows iteration error: %w", err)
	}

	return tenants, total, nil
}

// ==========================================
// WRITE OPERATIONS
// ==========================================

func (r *TenantRepository) CreateFullTenant(ctx context.Context, t *models.Tenant) error {
	err := r.stmtCreateTenant.QueryRowContext(ctx,
		t.UUID, t.FullName, t.ShortName, t.Domain, t.Subdomain,
		t.DomainExpiry, t.PlanExpiry, t.RenewalCost, t.KYCMode,
		t.MarkupPercentage, t.UIJSONConfig,
	).Scan(&t.ID, &t.IsActive, &t.CreatedAt, &t.ModifiedAt)

	if err != nil {
		return err
	}

	go r.createTenantCaches(context.Background(), t)
	return nil
}

// CreateFullTenantWithTX inserts a tenant in tx. It is not cached here: the transaction may
// still roll back, and the first read caches it.
func (r *TenantRepository) CreateFullTenantWithTX(ctx context.Context, tx *sql.Tx, t *models.Tenant) error {
	return tx.StmtContext(ctx, r.stmtCreateTenant).QueryRowContext(ctx,
		t.UUID, t.FullName, t.ShortName, t.Domain, t.Subdomain,
		t.DomainExpiry, t.PlanExpiry, t.RenewalCost, t.KYCMode,
		t.MarkupPercentage, t.UIJSONConfig,
	).Scan(&t.ID, &t.IsActive, &t.CreatedAt, &t.ModifiedAt)
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

	go r.InvalidateTenantCaches(context.Background(), t)
	return nil
}

// UpdateFullTenantWithTX writes every profile column of t (not the active flag). The caller
// invalidates the tenant's caches after commit (InvalidateTenantCaches).
func (r *TenantRepository) UpdateFullTenantWithTX(ctx context.Context, tx *sql.Tx, t *models.Tenant) error {
	err := tx.StmtContext(ctx, r.stmtUpdateTenant).QueryRowContext(ctx,
		t.FullName, t.ShortName, t.Domain, t.Subdomain,
		t.DomainExpiry, t.PlanExpiry, t.RenewalCost, t.KYCMode,
		t.MarkupPercentage, t.UIJSONConfig,
		t.UUID,
	).Scan(&t.ModifiedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return interfaces.ErrTenantNotFound
	}
	return err
}

// ==========================================
// READ OPERATIONS (FULL ENTITY)
// ==========================================

func (r *TenantRepository) GetFullTenantByUUID(ctx context.Context, uuid string) (*models.Tenant, error) {
	cacheKey := r.tenantCacheKeys.FullUUID + uuid

	if t := r.readCachedData(ctx, cacheKey); t != nil {
		return t, nil
	}

	t, err := r.scanFullRetrieval(r.stmtGetFullByUUID.QueryRowContext(ctx, uuid))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, interfaces.ErrTenantNotFound // Safe translation
		}
		return nil, err // Safe pass-through for real DB errors
	}

	r.createTenantCaches(ctx, t)
	return t, nil
}

func (r *TenantRepository) GetFullTenantByShortName(ctx context.Context, shortName string) (*models.Tenant, error) {
	cacheKey := r.tenantCacheKeys.FullShort + shortName

	if t := r.readCachedData(ctx, cacheKey); t != nil {
		return t, nil
	}

	t, err := r.scanFullRetrieval(r.stmtGetFullByShort.QueryRowContext(ctx, shortName))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, interfaces.ErrTenantNotFound // Safe translation
		}
		return nil, err // Safe pass-through for real DB errors
	}

	r.createTenantCaches(ctx, t)
	return t, nil
}

func (r *TenantRepository) GetFullTenantByDomain(ctx context.Context, domain string) (*models.Tenant, error) {
	cacheKey := r.tenantCacheKeys.FullDomain + domain

	if t := r.readCachedData(ctx, cacheKey); t != nil {
		return t, nil
	}

	t, err := r.scanFullRetrieval(r.stmtGetFullByDomain.QueryRowContext(ctx, domain))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, interfaces.ErrTenantNotFound // Safe translation
		}
		return nil, err // Safe pass-through for real DB errors
	}

	r.createTenantCaches(ctx, t)
	return t, nil
}

// ==========================================
// READ OPERATIONS (PARTIAL ENTITY)
// ==========================================

func (r *TenantRepository) GetPartialTenantByUUID(ctx context.Context, uuid string) (*models.Tenant, error) {
	cacheKey := r.tenantCacheKeys.FullUUID + uuid

	if t := r.readCachedData(ctx, cacheKey); t != nil {
		return t, nil
	}

	t, err := r.scanPartialRetrieval(r.stmtGetPartialByUUID.QueryRowContext(ctx, uuid))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, interfaces.ErrTenantNotFound
		}
		return nil, err
	}
	return t, nil
}

func (r *TenantRepository) GetPartialTenantByDomain(ctx context.Context, domain string) (*models.Tenant, error) {
	cacheKey := r.tenantCacheKeys.FullDomain + domain

	if t := r.readCachedData(ctx, cacheKey); t != nil {
		return t, nil
	}

	t, err := r.scanPartialRetrieval(r.stmtGetPartialByDomain.QueryRowContext(ctx, domain))
	if err != nil {
		return nil, err
	}
	return t, nil
}

func (r *TenantRepository) GetPartialTenantByShortName(ctx context.Context, shortName string) (*models.Tenant, error) {
	cacheKey := r.tenantCacheKeys.FullShort + shortName

	if t := r.readCachedData(ctx, cacheKey); t != nil {
		return t, nil
	}

	t, err := r.scanPartialRetrieval(r.stmtGetPartialByShort.QueryRowContext(ctx, shortName))
	if err != nil {
		return nil, err
	}
	return t, nil
}

func (r *TenantRepository) GetFullTenantByID(ctx context.Context, id int64) (*models.Tenant, error) {
	query := fmt.Sprintf("SELECT %s FROM %s WHERE %s = $1", fullTenantColumns, schema.TableTenants, schema.ColTenantID)
	t, err := r.scanFullRetrieval(r.DB.Db.QueryRowContext(ctx, query, id))
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("tenant not found")
		}
		return nil, err
	}
	return t, nil
}

// UpdateTenantUILayoutWithTX replaces the tenant's UI layout and returns the updated row. The
// caller invalidates the tenant's caches after commit (InvalidateTenantCaches).
func (r *TenantRepository) UpdateTenantUILayoutWithTX(ctx context.Context, tx *sql.Tx, tenantID int64, uiConfigBytes []byte) (*models.Tenant, error) {
	query := fmt.Sprintf(
		"UPDATE %s SET %s = $1, %s = NOW() WHERE %s = $2 RETURNING %s",
		schema.TableTenants, schema.ColTenantUIJSONConfig, schema.ColTenantModifiedAt, schema.ColTenantID,
		fullTenantColumns,
	)
	t, err := r.scanFullRetrieval(tx.QueryRowContext(ctx, query, string(uiConfigBytes), tenantID))
	if errors.Is(err, sql.ErrNoRows) {
		return nil, interfaces.ErrTenantNotFound
	}
	return t, err
}

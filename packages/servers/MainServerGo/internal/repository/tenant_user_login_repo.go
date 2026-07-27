package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"

	"packages/servers/MainServerGo/interfaces"
	"packages/servers/MainServerGo/internal/models"
	"packages/servers/MainServerGo/internal/schema"
	"packages/servers/MainServerGo/utility/postgres"
	redis_client "packages/servers/MainServerGo/utility/redis"
)

type TenantUserLoginRepository struct {
	DB    *postgres.PostgresDBStruct
	Redis *redis_client.RedisClientStruct

	// Prepared Statements
	stmtGetFullUUID  *sql.Stmt
	stmtGetFullPhone *sql.Stmt
	stmtCreateAdmin  *sql.Stmt
	stmtUpdateAdmin  *sql.Stmt
}

var (
	adminRepoInstance *TenantUserLoginRepository
	adminRepoOnce     sync.Once
)

// adminCacheTTL is shorter than users/tenants because RBAC permissions need to reflect quickly
const adminCacheTTL = time.Minute * 15

// GetTenantUserLoginRepository implements Thread-Safe Lazy Initialization
func GetTenantUserLoginRepository() *TenantUserLoginRepository {
	adminRepoOnce.Do(func() {
		db := postgres.GetPostgresDB()
		rdb := redis_client.InitRedisClient()

		// ==========================================
		// 1. FULL QUERY BASE (11 Columns)
		// ==========================================
		queryFullSelect := fmt.Sprintf(`
			SELECT 
				%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s 
			FROM %s`,
			schema.ColTUID, schema.ColTUUID, schema.ColTUTenantID, schema.ColTUUsername,
			schema.ColTUPhoneNumber, schema.ColTUPasswordHash, schema.ColTURole, schema.ColTUIsActive, schema.ColTUPermissionsJSON,
			schema.ColTUCreatedAt, schema.ColTUModifiedAt,
			schema.TableTenantUserLogins,
		)

		// Get by UUID (Strict Tenant Isolation)
		stmtUUID, err := db.Db.Prepare(fmt.Sprintf(`%s WHERE %s = $1 AND %s = $2`, queryFullSelect, schema.ColTUTenantID, schema.ColTUUID))
		if err != nil {
			panic(fmt.Sprintf("FATAL: Failed to prepare GetFullAdminByUUID: %v", err))
		}

		// Get by Phone (Strict Tenant Isolation + Must be Active)
		stmtPhone, err := db.Db.Prepare(fmt.Sprintf(`%s WHERE %s = $1 AND %s = $2 AND %s = true`, queryFullSelect, schema.ColTUTenantID, schema.ColTUPhoneNumber, schema.ColTUIsActive))
		if err != nil {
			panic(fmt.Sprintf("FATAL: Failed to prepare GetFullAdminByPhone: %v", err))
		}

		// ==========================================
		// 2. CREATE QUERY
		// ==========================================
		queryCreate := fmt.Sprintf(`
			INSERT INTO %s (%s, %s, %s, %s, %s, %s, %s, %s)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
			RETURNING %s, %s, %s`,
			schema.TableTenantUserLogins,
			schema.ColTUUID, schema.ColTUTenantID, schema.ColTUUsername, schema.ColTUPhoneNumber,
			schema.ColTUPasswordHash, schema.ColTURole, schema.ColTUIsActive, schema.ColTUPermissionsJSON,
			schema.ColTUID, schema.ColTUCreatedAt, schema.ColTUModifiedAt,
		)
		stmtCreate, err := db.Db.Prepare(queryCreate)
		if err != nil {
			panic(fmt.Sprintf("FATAL: Failed to prepare CreateAdmin: %v", err))
		}

		// ==========================================
		// 3. UPDATE QUERY (Permissions, Role, Status)
		// ==========================================
		queryUpdate := fmt.Sprintf(`
			UPDATE %s SET 
				%s = $1, %s = $2, %s = $3, %s = $4, %s = $5, %s = $6,
				%s = CURRENT_TIMESTAMP
			WHERE %s = $7 AND %s = $8
			RETURNING %s`,
			schema.TableTenantUserLogins,
			schema.ColTUUsername, schema.ColTUPhoneNumber, schema.ColTUPasswordHash,
			schema.ColTURole, schema.ColTUIsActive, schema.ColTUPermissionsJSON,
			schema.ColTUModifiedAt,
			schema.ColTUTenantID, schema.ColTUUID,
			schema.ColTUModifiedAt,
		)
		stmtUpdate, err := db.Db.Prepare(queryUpdate)
		if err != nil {
			panic(fmt.Sprintf("FATAL: Failed to prepare UpdateAdmin: %v", err))
		}

		adminRepoInstance = &TenantUserLoginRepository{
			DB:               db,
			Redis:            rdb,
			stmtGetFullUUID:  stmtUUID,
			stmtGetFullPhone: stmtPhone,
			stmtCreateAdmin:  stmtCreate,
			stmtUpdateAdmin:  stmtUpdate,
		}
	})
	return adminRepoInstance
}

// ==========================================
// INTERNAL CACHE & SCAN HELPERS
// ==========================================

func (r *TenantUserLoginRepository) generateCacheKey(a *models.TenantUserLogin) []string {
	keys := make([]string, 0, 2)

	// STRICT TENANT ISOLATION: The tenantID is the root of the cache key
	base := fmt.Sprintf("tenant/%d/admin/full/", a.TenantID)

	keys = append(keys, r.Redis.GetRedisKey(base+"uuid/"+a.UUID))
	keys = append(keys, r.Redis.GetRedisKey(base+"phone/"+a.PhoneNumber))

	return keys
}

func (r *TenantUserLoginRepository) invalidateAdminCaches(ctx context.Context, a *models.TenantUserLogin) {
	keys := r.generateCacheKey(a)
	r.Redis.RemoveKey(ctx, keys...)
}

func (r *TenantUserLoginRepository) createAdminCaches(ctx context.Context, a *models.TenantUserLogin) {
	keys := r.generateCacheKey(a)
	if jsonData, err := json.Marshal(a); err == nil {
		for _, cacheKey := range keys {
			r.Redis.SetStringDataWithExpiry(ctx, cacheKey, string(jsonData), adminCacheTTL)
		}
	}
}

func (r *TenantUserLoginRepository) scanFullRetrieval(row *sql.Row) (*models.TenantUserLogin, error) {
	var a models.TenantUserLogin
	err := row.Scan(
		&a.ID, &a.UUID, &a.TenantID, &a.Username,
		&a.PhoneNumber, &a.PasswordHash, &a.Role, &a.IsActive, &a.PermissionsJSON,
		&a.CreatedAt, &a.ModifiedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			// FIXED: Return the Sentinel Error
			return nil, interfaces.ErrUserNotFound
		}
		return nil, err
	}
	return &a, nil
}

// ==========================================
// WRITE OPERATIONS
// ==========================================

func (r *TenantUserLoginRepository) CreateFullAdmin(ctx context.Context, a *models.TenantUserLogin) error {
	err := r.stmtCreateAdmin.QueryRowContext(ctx,
		a.UUID, a.TenantID, a.Username, a.PhoneNumber,
		a.PasswordHash, a.Role, a.IsActive, a.PermissionsJSON,
	).Scan(&a.ID, &a.CreatedAt, &a.ModifiedAt)

	if err != nil {
		return err
	}

	go r.createAdminCaches(context.Background(), a)
	return nil
}

func (r *TenantUserLoginRepository) UpdateFullAdmin(ctx context.Context, a *models.TenantUserLogin) error {
	err := r.stmtUpdateAdmin.QueryRowContext(ctx,
		a.Username, a.PhoneNumber, a.PasswordHash,
		a.Role, a.IsActive, a.PermissionsJSON,
		a.TenantID, a.UUID, // WHERE clause variables
	).Scan(&a.ModifiedAt)

	if err != nil {
		return err
	}

	// CRITICAL: Bust the cache instantly so revoked permissions take immediate effect
	go r.invalidateAdminCaches(context.Background(), a)
	return nil
}

// ==========================================
// READ OPERATIONS (Cache-Aside Pattern)
// ==========================================

// GetFullAdminByUUID is used primarily for middleware authorization and profile fetching
func (r *TenantUserLoginRepository) GetFullAdminByUUID(ctx context.Context, tenantID int64, uuid string) (*models.TenantUserLogin, error) {
	cacheKey := r.Redis.GetRedisKey(fmt.Sprintf("tenant/%d/admin/full/uuid/%s", tenantID, uuid))

	if cachedStr, err := r.Redis.GetStringData(ctx, cacheKey); err == nil && cachedStr != "" {
		var a models.TenantUserLogin
		if err := json.Unmarshal([]byte(cachedStr), &a); err == nil {
			return &a, nil
		}
	}

	a, err := r.scanFullRetrieval(r.stmtGetFullUUID.QueryRowContext(ctx, tenantID, uuid))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			// FIXED: Return the Sentinel Error
			return nil, interfaces.ErrUserNotFound
		}
		return nil, err
	}

	go r.createAdminCaches(context.Background(), a)
	return a, nil
}

// GetActiveAdminByPhone is used for the Login flow. It strictly enforces the tu_is_active flag.
func (r *TenantUserLoginRepository) GetActiveAdminByPhone(ctx context.Context, tenantID int64, phone string) (*models.TenantUserLogin, error) {
	cacheKey := r.Redis.GetRedisKey(fmt.Sprintf("tenant/%d/admin/full/phone/%s", tenantID, phone))

	if cachedStr, err := r.Redis.GetStringData(ctx, cacheKey); err == nil && cachedStr != "" {
		var a models.TenantUserLogin
		if err := json.Unmarshal([]byte(cachedStr), &a); err == nil {
			// Double check active status just in case cache wasn't invalidated properly on a ban
			if a.IsActive {
				return &a, nil
			}
		}
	}

	a, err := r.scanFullRetrieval(r.stmtGetFullPhone.QueryRowContext(ctx, tenantID, phone))
	if err != nil {
		return nil, err // Fails if they don't exist OR if IsActive = false due to the SQL WHERE clause
	}

	go r.createAdminCaches(context.Background(), a)
	return a, nil
}

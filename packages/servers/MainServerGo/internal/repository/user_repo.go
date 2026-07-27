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

type UserRepository struct {
	DB               *postgres.PostgresDBStruct
	Redis            *redis_client.RedisClientStruct
	stmtGetFullUUID  *sql.Stmt
	stmtGetFullPhone *sql.Stmt
	stmtCreateUser   *sql.Stmt
	stmtUpdateUser   *sql.Stmt
}

var (
	userRepoInstance *UserRepository
	userRepoOnce     sync.Once
)

const userCacheTTL = time.Minute * 30

func GetUserRepository() *UserRepository {
	userRepoOnce.Do(func() {
		db := postgres.GetPostgresDB()
		rdb := redis_client.InitRedisClient()

		// 1. FULL QUERY BASE (13 Columns)
		queryFullSelect := fmt.Sprintf(`
			SELECT 
				%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, user_created_at, user_modified_at 
			FROM %s`,
			schema.ColUserID, schema.ColUserUUID, schema.ColUserTenantID, schema.ColUserFullName,
			schema.ColUserPhoneNumber, schema.ColUserEmailID, schema.ColUserKYCStatus, schema.ColUserStatusApprovedBy,
			schema.ColUserDocumentJSON, schema.ColUserERPUniqueID, schema.ColUserVaultBalance,
			schema.TableUsers,
		)

		// Pre-compile strict tenant-isolated queries
		stmtUUID, err := db.Db.Prepare(fmt.Sprintf(`%s WHERE %s = $1 AND %s = $2`, queryFullSelect, schema.ColUserTenantID, schema.ColUserUUID))
		if err != nil {
			panic(fmt.Sprintf("FATAL: Failed to prepare GetFullUserByUUID: %v", err))
		}

		stmtPhone, err := db.Db.Prepare(fmt.Sprintf(`%s WHERE %s = $1 AND %s = $2`, queryFullSelect, schema.ColUserTenantID, schema.ColUserPhoneNumber))
		if err != nil {
			panic(fmt.Sprintf("FATAL: Failed to prepare GetFullUserByPhone: %v", err))
		}

		// 2. CREATE QUERY
		queryCreate := fmt.Sprintf(`
			INSERT INTO %s (%s, %s, %s, %s, %s, %s, %s, %s)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
			RETURNING %s, user_created_at, user_modified_at`,
			schema.TableUsers,
			schema.ColUserUUID, schema.ColUserTenantID, schema.ColUserFullName, schema.ColUserPhoneNumber,
			schema.ColUserEmailID, schema.ColUserKYCStatus, schema.ColUserDocumentJSON, schema.ColUserERPUniqueID,
			schema.ColUserID,
		)
		stmtCreate, err := db.Db.Prepare(queryCreate)
		if err != nil {
			panic(fmt.Sprintf("FATAL: Failed to prepare CreateUser: %v", err))
		}

		// 3. UPDATE QUERY (Protects ID, UUID, TenantID, Balance, and CreatedAt)
		queryUpdate := fmt.Sprintf(`
			UPDATE %s SET 
				%s = $1, %s = $2, %s = $3, %s = $4, %s = $5, %s = $6, %s = $7,
				user_modified_at = CURRENT_TIMESTAMP
			WHERE %s = $8 AND %s = $9
			RETURNING user_modified_at`,
			schema.TableUsers,
			schema.ColUserFullName, schema.ColUserPhoneNumber, schema.ColUserEmailID,
			schema.ColUserKYCStatus, schema.ColUserStatusApprovedBy, schema.ColUserDocumentJSON, schema.ColUserERPUniqueID,
			schema.ColUserTenantID, schema.ColUserUUID,
		)
		stmtUpdate, err := db.Db.Prepare(queryUpdate)
		if err != nil {
			panic(fmt.Sprintf("FATAL: Failed to prepare UpdateUser: %v", err))
		}

		userRepoInstance = &UserRepository{
			DB:               db,
			Redis:            rdb,
			stmtGetFullUUID:  stmtUUID,
			stmtGetFullPhone: stmtPhone,
			stmtCreateUser:   stmtCreate,
			stmtUpdateUser:   stmtUpdate,
		}
	})
	return userRepoInstance
}

// ==========================================
// INTERNAL CACHE & SCAN HELPERS
// ==========================================

func (r *UserRepository) generateCacheKey(t *models.User) []string {
	keys := make([]string, 0, 2)
	// STRICT TENANT ISOLATION IN CACHE KEYS
	base := fmt.Sprintf("tenant/%d/user/full/", t.TenantID)

	keys = append(keys, r.Redis.GetRedisKey(base+"uuid/"+t.UUID))
	keys = append(keys, r.Redis.GetRedisKey(base+"phone/"+t.PhoneNumber))

	return keys
}

func (r *UserRepository) invalidateUserCaches(ctx context.Context, u *models.User) {
	keys := r.generateCacheKey(u)
	r.Redis.RemoveKey(ctx, keys...)
}

func (r *UserRepository) createUserCaches(ctx context.Context, u *models.User) {
	keys := r.generateCacheKey(u)
	if jsonData, err := json.Marshal(u); err == nil {
		for _, cacheKey := range keys {
			r.Redis.SetStringDataWithExpiry(ctx, cacheKey, string(jsonData), userCacheTTL)
		}
	}
}

func (r *UserRepository) scanFullRetrieval(row *sql.Row) (*models.User, error) {
	var u models.User
	err := row.Scan(
		&u.ID, &u.UUID, &u.TenantID, &u.FullName,
		&u.PhoneNumber, &u.EmailID, &u.KYCStatus, &u.StatusApprovedBy,
		&u.DocumentJSON, &u.ERPUniqueID, &u.VaultBalance,
		&u.CreatedAt, &u.ModifiedAt,
	)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

// ==========================================
// OPERATIONS
// ==========================================

func (r *UserRepository) CreateFullUser(ctx context.Context, u *models.User) error {
	err := r.stmtCreateUser.QueryRowContext(ctx,
		u.UUID, u.TenantID, u.FullName, u.PhoneNumber,
		u.EmailID, u.KYCStatus, u.DocumentJSON, u.ERPUniqueID,
	).Scan(&u.ID, &u.CreatedAt, &u.ModifiedAt)

	if err != nil {
		return err
	}
	go r.createUserCaches(context.Background(), u)
	return nil
}

func (r *UserRepository) UpdateFullUser(ctx context.Context, u *models.User) error {
	err := r.stmtUpdateUser.QueryRowContext(ctx,
		u.FullName, u.PhoneNumber, u.EmailID, u.KYCStatus,
		u.StatusApprovedBy, u.DocumentJSON, u.ERPUniqueID,
		u.TenantID, u.UUID,
	).Scan(&u.ModifiedAt)

	if err != nil {
		return err
	}
	go r.invalidateUserCaches(context.Background(), u)
	return nil
}

func (r *UserRepository) GetFullUserByPhone(ctx context.Context, tenantID int64, phone string) (*models.User, error) {
	cacheKey := r.Redis.GetRedisKey(fmt.Sprintf("tenant/%d/user/full/phone/%s", tenantID, phone))

	if cachedStr, err := r.Redis.GetStringData(ctx, cacheKey); err == nil && cachedStr != "" {
		var u models.User
		if err := json.Unmarshal([]byte(cachedStr), &u); err == nil {
			return &u, nil
		}
	}

	u, err := r.scanFullRetrieval(r.stmtGetFullPhone.QueryRowContext(ctx, tenantID, phone))
	if err != nil {
		return nil, interfaces.ErrUserNotFound
	}
	go r.createUserCaches(context.Background(), u)
	return u, nil
}

// GetFullUserByUUID fetches a user using their UUID, strictly isolated by the internal tenantID (int64)
func (r *UserRepository) GetFullUserByUUID(ctx context.Context, tenantID int64, userUUID string) (*models.User, error) {
	// 1. Generate the strictly isolated Cache Key
	cacheKey := r.Redis.GetRedisKey(fmt.Sprintf("tenant/%d/user/full/uuid/%s", tenantID, userUUID))

	// 2. Check Redis Cache First
	if cachedStr, err := r.Redis.GetStringData(ctx, cacheKey); err == nil && cachedStr != "" {
		var u models.User
		if err := json.Unmarshal([]byte(cachedStr), &u); err == nil {
			return &u, nil // CACHE HIT
		}
	}

	// 3. CACHE MISS: Query the Database using the pre-compiled stmtGetFullUUID
	// Notice we pass tenantID (int64) first, then userUUID (string) matching the $1 and $2 in our SQL
	u, err := r.scanFullRetrieval(r.stmtGetFullUUID.QueryRowContext(ctx, tenantID, userUUID))
	if err != nil {
		return nil, interfaces.ErrUserNotFound
		// return nil, err // Returns sql.ErrNoRows if not found or if the user belongs to a different tenant
	}

	// 4. Populate Cache in Background
	go r.createUserCaches(context.Background(), u)

	return u, nil
}

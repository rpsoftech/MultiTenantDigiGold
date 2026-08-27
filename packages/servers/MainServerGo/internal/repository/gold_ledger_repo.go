package repository

import (
	"context"
	"database/sql"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/models"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/schema"
	"github.com/rpsoftech/DigiGold/MainServerGo/utility/postgres"
	redis_client "github.com/rpsoftech/DigiGold/MainServerGo/utility/redis"
)

type GoldLedgerRepository struct {
	DB                    *postgres.PostgresDBStruct
	Redis                 *redis_client.RedisClientStruct
	stmtLockUser          *sql.Stmt
	stmtUpdateUserBalance *sql.Stmt
	stmtInsertLedger      *sql.Stmt
}

var (
	goldLedgerRepoInstance *GoldLedgerRepository
	goldLedgerRepoOnce     sync.Once
)

func InitGoldLedgerRepo() *GoldLedgerRepository {
	goldLedgerRepoOnce.Do(func() {
		db := postgres.GetPostgresDB()
		rdb := redis_client.InitRedisClient()

		// 1. Prepared Statement: Lock User Balance
		queryLock := fmt.Sprintf(`SELECT %s, %s, %s, %s FROM %s WHERE %s = $1 FOR UPDATE`,
			schema.ColUserUUID, schema.ColUserPhoneNumber, schema.ColUserTenantID, schema.ColUserVaultBalance,
			schema.TableUsers, schema.ColUserID,
		)
		stmtLock, err := db.Db.Prepare(queryLock)
		if err != nil {
			panic(fmt.Errorf("fatal: failed to prepare stmtLockUser: %w", err))
		}

		// 2. Prepared Statement: Update User Balance
		queryUpdate := fmt.Sprintf(`UPDATE %s SET %s = $1, %s = CURRENT_TIMESTAMP WHERE %s = $2`,
			schema.TableUsers, schema.ColUserVaultBalance, schema.ColUserModifiedAt, schema.ColUserID,
		)
		stmtUpdate, err := db.Db.Prepare(queryUpdate)
		if err != nil {
			panic(fmt.Errorf("fatal: failed to prepare stmtUpdateUserBalance: %w", err))
		}

		// 3. Prepared Statement: Insert Ledger
		queryInsert := fmt.Sprintf(`
			INSERT INTO %s (
				%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
			) VALUES (
				$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
			) RETURNING %s, %s`,
			schema.TableGoldTransactionLedger,
			schema.ColGLUUID, schema.ColGLTenantID, schema.ColGLUserID, schema.ColGLEventType,
			schema.ColGLPaymentMode, schema.ColGLWeightGrams, schema.ColGLTotalAmountINR,
			schema.ColGLRunningGoldBalanceGrams, schema.ColGLMCXBaseRate, schema.ColGLMasterMarginApplied,
			schema.ColGLTenantMarginApplied, schema.ColGLGSTApplied, schema.ColGLFinalRatePerGram,
			schema.ColGLReferenceID, schema.ColGLMetadataJSON,
			schema.ColGLID, schema.ColGLCreatedAt,
		)

		stmtInsert, err := db.Db.Prepare(queryInsert)
		if err != nil {
			panic(fmt.Errorf("fatal: failed to prepare stmtInsertLedger: %w", err))
		}

		goldLedgerRepoInstance = &GoldLedgerRepository{
			DB:                    db,
			Redis:                 rdb,
			stmtLockUser:          stmtLock,
			stmtUpdateUserBalance: stmtUpdate,
			stmtInsertLedger:      stmtInsert,
		}
	})
	return goldLedgerRepoInstance
}

// Write Operations (Event sourcing delegated to Service Layer)
func (r *GoldLedgerRepository) RecordTransactionWithTX(ctx context.Context, tx *sql.Tx, entry *models.GoldTransactionLedger) (*models.GoldTransactionLedger, error) {
	var userUUID, userPhone string
	var tenantID int64
	var currentBalance float64

	// 1. Lock User Row
	err := tx.StmtContext(ctx, r.stmtLockUser).QueryRowContext(ctx, entry.UserID).Scan(&userUUID, &userPhone, &tenantID, &currentBalance)
	if err != nil {
		return nil, fmt.Errorf("failed to lock user vault balance: %w", err)
	}

	// 2. Math Calculation
	newBalance := currentBalance + entry.WeightGrams
	entry.RunningGoldBalanceGrams = newBalance

	// 3. Update User Balance
	_, err = tx.StmtContext(ctx, r.stmtUpdateUserBalance).ExecContext(ctx, newBalance, entry.UserID)
	if err != nil {
		return nil, fmt.Errorf("failed to update user vault balance: %w", err)
	}

	// 4. Generate UUID
	if entry.UUID == "" {
		entry.UUID = uuid.New().String()
	}

	metadataBytes := []byte(entry.MetadataJSON)
	if len(metadataBytes) == 0 {
		metadataBytes = []byte("{}")
	}

	// 5. Insert Ledger Entry
	err = tx.StmtContext(ctx, r.stmtInsertLedger).QueryRowContext(ctx,
		entry.UUID, entry.TenantID, entry.UserID, entry.EventType,
		entry.PaymentMode, entry.WeightGrams, entry.TotalAmountINR,
		entry.RunningGoldBalanceGrams, entry.MCXBaseRate, entry.MasterMarginApplied,
		entry.TenantMarginApplied, entry.GSTApplied, entry.FinalRatePerGram,
		entry.ReferenceID, metadataBytes,
	).Scan(&entry.ID, &entry.CreatedAt)

	if err != nil {
		return nil, fmt.Errorf("failed to insert gold transaction ledger: %w", err)
	}

	// 6. Asynchronous Redis Cache Invalidation
	go func() {
		bgCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		prefix := fmt.Sprintf("tenant/%d/user/full/", tenantID)
		_ = r.Redis.RemoveKey(bgCtx, prefix+"uuid/"+userUUID, prefix+"phone/"+userPhone)
	}()

	return entry, nil
}

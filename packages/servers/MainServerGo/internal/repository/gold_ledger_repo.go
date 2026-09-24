package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"math"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/rpsoftech/DigiGold/MainServerGo/interfaces"
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
		// Scoped by tenant so a trade can never touch another tenant's customer.
		queryLock := fmt.Sprintf(`SELECT %s, %s, %s, %s FROM %s WHERE %s = $1 AND %s = $2 FOR UPDATE`,
			schema.ColUserUUID, schema.ColUserPhoneNumber, schema.ColUserTenantID, schema.ColUserVaultBalance,
			schema.TableUsers, schema.ColUserID, schema.ColUserTenantID,
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
	err := tx.StmtContext(ctx, r.stmtLockUser).QueryRowContext(ctx, entry.UserID, entry.TenantID).Scan(&userUUID, &userPhone, &tenantID, &currentBalance)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, interfaces.ErrUserNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("failed to lock user vault balance: %w", err)
	}

	// 2. Math Calculation (checked under the row lock, so concurrent debits cannot overdraw)
	newBalance := math.Round((currentBalance+entry.WeightGrams)*10000) / 10000
	if newBalance < 0 {
		return nil, interfaces.ErrInsufficientBalance
	}
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

func (r *GoldLedgerRepository) GetTransactionHistory(ctx context.Context, tenantID int64, userID int64, limit int, offset int) ([]*models.GoldTransactionLedger, error) {
	query := fmt.Sprintf(`
		SELECT 
			%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
		FROM %s 
		WHERE %s = $1 AND %s = $2
		ORDER BY %s DESC
		LIMIT $3 OFFSET $4
	`, schema.ColGLUUID, schema.ColGLEventType, schema.ColGLPaymentMode, schema.ColGLWeightGrams,
		schema.ColGLTotalAmountINR, schema.ColGLRunningGoldBalanceGrams, schema.ColGLMCXBaseRate,
		schema.ColGLTenantMarginApplied, schema.ColGLGSTApplied, schema.ColGLFinalRatePerGram,
		schema.ColGLReferenceID, schema.ColGLMetadataJSON, schema.ColGLCreatedAt,
		schema.TableGoldTransactionLedger, schema.ColGLTenantID, schema.ColGLUserID, schema.ColGLCreatedAt)

	rows, err := r.DB.Db.QueryContext(ctx, query, tenantID, userID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to get transaction history: %w", err)
	}
	defer rows.Close()

	var history []*models.GoldTransactionLedger
	for rows.Next() {
		var entry models.GoldTransactionLedger
		var refID sql.NullString
		var metaJSON []byte
		err := rows.Scan(
			&entry.UUID, &entry.EventType, &entry.PaymentMode, &entry.WeightGrams,
			&entry.TotalAmountINR, &entry.RunningGoldBalanceGrams, &entry.MCXBaseRate,
			&entry.TenantMarginApplied, &entry.GSTApplied, &entry.FinalRatePerGram,
			&refID, &metaJSON, &entry.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan ledger row: %w", err)
		}
		if refID.Valid {
			entry.ReferenceID = refID.String
		}
		entry.MetadataJSON = metaJSON
		history = append(history, &entry)
	}

	return history, nil
}

func (r *GoldLedgerRepository) GetLedgerByTenant(ctx context.Context, tenantID int64, limit int, offset int) ([]*models.GoldTransactionLedger, error) {
	query := fmt.Sprintf(`
		SELECT 
			%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
		FROM %s 
		WHERE %s = $1
		ORDER BY %s DESC
		LIMIT $2 OFFSET $3
	`, schema.ColGLUUID, schema.ColGLEventType, schema.ColGLPaymentMode, schema.ColGLWeightGrams,
		schema.ColGLTotalAmountINR, schema.ColGLRunningGoldBalanceGrams, schema.ColGLMCXBaseRate,
		schema.ColGLTenantMarginApplied, schema.ColGLGSTApplied, schema.ColGLFinalRatePerGram,
		schema.ColGLReferenceID, schema.ColGLMetadataJSON, schema.ColGLCreatedAt,
		schema.TableGoldTransactionLedger, schema.ColGLTenantID, schema.ColGLCreatedAt)

	rows, err := r.DB.Db.QueryContext(ctx, query, tenantID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to get tenant ledger: %w", err)
	}
	defer rows.Close()

	var history []*models.GoldTransactionLedger
	for rows.Next() {
		var entry models.GoldTransactionLedger
		var refID sql.NullString
		var metaJSON []byte
		err := rows.Scan(
			&entry.UUID, &entry.EventType, &entry.PaymentMode, &entry.WeightGrams,
			&entry.TotalAmountINR, &entry.RunningGoldBalanceGrams, &entry.MCXBaseRate,
			&entry.TenantMarginApplied, &entry.GSTApplied, &entry.FinalRatePerGram,
			&refID, &metaJSON, &entry.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan ledger row: %w", err)
		}
		if refID.Valid {
			entry.ReferenceID = refID.String
		}
		entry.MetadataJSON = metaJSON
		history = append(history, &entry)
	}

	return history, nil
}

type TenantAnalytics struct {
	TotalVolumeGrams  float64 `json:"total_volume_grams"`
	TotalRevenueINR   float64 `json:"total_revenue_inr"`
	TotalMarginEarned float64 `json:"total_margin_earned"`
	TotalTransactions int64   `json:"total_transactions"`
}

func (r *GoldLedgerRepository) GetTenantAnalytics(ctx context.Context, tenantID int64) (*TenantAnalytics, error) {
	query := `
		SELECT 
			COALESCE(SUM(ABS(gl_weight_grams)), 0) as total_volume_grams,
			COALESCE(SUM(ABS(gl_total_amount_inr)), 0) as total_revenue_inr,
			COALESCE(SUM(gl_tenant_margin_applied), 0) as total_margin_earned,
			COUNT(gl_id) as total_transactions
		FROM gold_transaction_ledger
		WHERE gl_tenant_id = $1 AND gl_event_type IN ('GOLD_PURCHASE', 'PHYSICAL_REDEMPTION')
	`
	var analytics TenantAnalytics
	err := r.DB.Db.QueryRowContext(ctx, query, tenantID).Scan(
		&analytics.TotalVolumeGrams,
		&analytics.TotalRevenueINR,
		&analytics.TotalMarginEarned,
		&analytics.TotalTransactions,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get tenant analytics: %w", err)
	}
	return &analytics, nil
}

// GetEntryForUpdateWithTX locks a ledger row of the given tenant inside tx.
func (r *GoldLedgerRepository) GetEntryForUpdateWithTX(ctx context.Context, tx *sql.Tx, tenantID int64, ledgerUUID string) (*models.GoldTransactionLedger, error) {
	query := fmt.Sprintf(`
		SELECT %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
		FROM %s
		WHERE %s = $1 AND %s = $2
		FOR UPDATE`,
		schema.ColGLID, schema.ColGLUserID, schema.ColGLEventType, schema.ColGLWeightGrams,
		schema.ColGLTotalAmountINR, schema.ColGLMCXBaseRate, schema.ColGLTenantMarginApplied,
		schema.ColGLGSTApplied, schema.ColGLFinalRatePerGram, schema.ColGLReferenceID,
		schema.TableGoldTransactionLedger, schema.ColGLUUID, schema.ColGLTenantID,
	)

	entry := models.GoldTransactionLedger{UUID: ledgerUUID, TenantID: tenantID}
	var refID sql.NullString
	err := tx.QueryRowContext(ctx, query, ledgerUUID, tenantID).Scan(
		&entry.ID, &entry.UserID, &entry.EventType, &entry.WeightGrams,
		&entry.TotalAmountINR, &entry.MCXBaseRate, &entry.TenantMarginApplied,
		&entry.GSTApplied, &entry.FinalRatePerGram, &refID,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, interfaces.ErrLedgerEntryNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("failed to lock ledger entry: %w", err)
	}
	entry.ReferenceID = refID.String
	return &entry, nil
}

// ReferenceExistsWithTX reports whether the tenant already has a ledger row with this reference ID.
func (r *GoldLedgerRepository) ReferenceExistsWithTX(ctx context.Context, tx *sql.Tx, tenantID int64, referenceID string) (bool, error) {
	query := fmt.Sprintf(`SELECT EXISTS (SELECT 1 FROM %s WHERE %s = $1 AND %s = $2)`,
		schema.TableGoldTransactionLedger, schema.ColGLTenantID, schema.ColGLReferenceID,
	)
	var exists bool
	if err := tx.QueryRowContext(ctx, query, tenantID, referenceID).Scan(&exists); err != nil {
		return false, fmt.Errorf("failed to check ledger reference: %w", err)
	}
	return exists, nil
}

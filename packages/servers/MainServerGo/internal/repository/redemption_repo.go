package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"sync"

	"github.com/rpsoftech/DigiGold/MainServerGo/interfaces"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/models"
	"github.com/rpsoftech/DigiGold/MainServerGo/utility/postgres"
)

type RedemptionRepository struct {
	DB *postgres.PostgresDBStruct
}

var (
	redemptionRepoInstance *RedemptionRepository
	redemptionRepoOnce     sync.Once
)

func InitRedemptionRepo() *RedemptionRepository {
	redemptionRepoOnce.Do(func() {
		redemptionRepoInstance = &RedemptionRepository{
			DB: postgres.GetPostgresDB(),
		}
	})
	return redemptionRepoInstance
}

// CreateWithTX inserts a PENDING redemption request for an existing ledger debit.
func (r *RedemptionRepository) CreateWithTX(ctx context.Context, tx *sql.Tx, rr *models.RedemptionRequest) error {
	query := `
		INSERT INTO redemption_requests (
			rr_tenant_id, rr_user_id, rr_ledger_id, rr_weight_grams, rr_status, rr_pickup_code
		) VALUES ($1, $2, $3, $4, 'PENDING', $5)
		RETURNING rr_id, rr_uuid, rr_status, rr_created_at
	`
	err := tx.QueryRowContext(ctx, query, rr.TenantID, rr.UserID, rr.LedgerID, rr.WeightGrams, rr.PickupCode).
		Scan(&rr.ID, &rr.UUID, &rr.Status, &rr.CreatedAt)
	if err != nil {
		return fmt.Errorf("failed to create redemption request: %w", err)
	}
	return nil
}

// ListByUser returns a customer's redemption requests, newest first, including pickup codes.
func (r *RedemptionRepository) ListByUser(ctx context.Context, tenantID, userID int64, limit, offset int) ([]*models.RedemptionRequest, error) {
	query := `
		SELECT rr.rr_uuid, gl.gl_uuid, rr.rr_weight_grams, rr.rr_status, rr.rr_pickup_code,
		       rr.rr_collected_at, rr.rr_cancelled_at, rr.rr_created_at, rr.rr_failed_code_attempts
		FROM redemption_requests rr
		JOIN gold_transaction_ledger gl ON gl.gl_id = rr.rr_ledger_id
		WHERE rr.rr_tenant_id = $1 AND rr.rr_user_id = $2
		ORDER BY rr.rr_created_at DESC, rr.rr_id DESC
		LIMIT $3 OFFSET $4
	`
	rows, err := r.DB.Db.QueryContext(ctx, query, tenantID, userID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to list redemptions: %w", err)
	}
	defer rows.Close()

	list := []*models.RedemptionRequest{}
	for rows.Next() {
		var rr models.RedemptionRequest
		if err := rows.Scan(&rr.UUID, &rr.LedgerUUID, &rr.WeightGrams, &rr.Status, &rr.PickupCode,
			&rr.CollectedAt, &rr.CancelledAt, &rr.CreatedAt, &rr.FailedCodeAttempts); err != nil {
			return nil, fmt.Errorf("failed to scan redemption: %w", err)
		}
		if rr.Status == models.RedemptionPending {
			rr.SetCodeAttemptsLeft()
		}
		list = append(list, &rr)
	}
	return list, rows.Err()
}

// ListPendingByTenant returns the tenant's PENDING requests with customer details
// for the counter. Pickup codes are never returned to staff. If phone is not
// empty, only that customer's requests are returned.
func (r *RedemptionRepository) ListPendingByTenant(ctx context.Context, tenantID int64, phone string, limit, offset int) ([]*models.RedemptionRequest, error) {
	query := `
		SELECT rr.rr_uuid, gl.gl_uuid, rr.rr_weight_grams, rr.rr_status, rr.rr_created_at,
		       COALESCE(u.user_full_name, ''), u.user_phone_number, rr.rr_failed_code_attempts
		FROM redemption_requests rr
		JOIN gold_transaction_ledger gl ON gl.gl_id = rr.rr_ledger_id
		JOIN users u ON u.user_id = rr.rr_user_id
		WHERE rr.rr_tenant_id = $1 AND rr.rr_status = 'PENDING'
		  AND ($2 = '' OR u.user_phone_number = $2)
		-- rr_id breaks ties between requests made in the same instant, so pages never overlap.
		ORDER BY rr.rr_created_at, rr.rr_id
		LIMIT $3 OFFSET $4
	`
	rows, err := r.DB.Db.QueryContext(ctx, query, tenantID, phone, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to list pending redemptions: %w", err)
	}
	defer rows.Close()

	list := []*models.RedemptionRequest{}
	for rows.Next() {
		var rr models.RedemptionRequest
		if err := rows.Scan(&rr.UUID, &rr.LedgerUUID, &rr.WeightGrams, &rr.Status, &rr.CreatedAt,
			&rr.CustomerName, &rr.CustomerPhone, &rr.FailedCodeAttempts); err != nil {
			return nil, fmt.Errorf("failed to scan redemption: %w", err)
		}
		rr.SetCodeAttemptsLeft()
		list = append(list, &rr)
	}
	return list, rows.Err()
}

// ListCollectedTodayByTenant returns the requests handed over at the tenant's counter
// today (IST), newest first, with the customer and the staff member who handed them over.
func (r *RedemptionRepository) ListCollectedTodayByTenant(ctx context.Context, tenantID int64, limit, offset int) ([]*models.RedemptionRequest, error) {
	query := `
		SELECT rr.rr_uuid, gl.gl_uuid, rr.rr_weight_grams, rr.rr_status, rr.rr_created_at,
		       rr.rr_collected_at, COALESCE(u.user_full_name, ''), u.user_phone_number,
		       COALESCE(tu.tu_username, '')
		FROM redemption_requests rr
		JOIN gold_transaction_ledger gl ON gl.gl_id = rr.rr_ledger_id
		JOIN users u ON u.user_id = rr.rr_user_id
		LEFT JOIN tenant_user_logins tu ON tu.tu_id = rr.rr_collected_by
		WHERE rr.rr_tenant_id = $1 AND rr.rr_status = 'COLLECTED'
		  AND rr.rr_collected_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata')
		ORDER BY rr.rr_collected_at DESC, rr.rr_id DESC
		LIMIT $2 OFFSET $3
	`
	rows, err := r.DB.Db.QueryContext(ctx, query, tenantID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to list collected redemptions: %w", err)
	}
	defer rows.Close()

	list := []*models.RedemptionRequest{}
	for rows.Next() {
		var rr models.RedemptionRequest
		if err := rows.Scan(&rr.UUID, &rr.LedgerUUID, &rr.WeightGrams, &rr.Status, &rr.CreatedAt,
			&rr.CollectedAt, &rr.CustomerName, &rr.CustomerPhone, &rr.CollectedBy); err != nil {
			return nil, fmt.Errorf("failed to scan collected redemption: %w", err)
		}
		list = append(list, &rr)
	}
	return list, rows.Err()
}

// GetForUpdateWithTX locks one of the tenant's redemption requests inside tx.
func (r *RedemptionRepository) GetForUpdateWithTX(ctx context.Context, tx *sql.Tx, tenantID int64, rrUUID string) (*models.RedemptionRequest, error) {
	query := `
		SELECT rr.rr_id, rr.rr_user_id, rr.rr_ledger_id, gl.gl_uuid, rr.rr_weight_grams, rr.rr_status, rr.rr_pickup_code,
		       rr.rr_failed_code_attempts
		FROM redemption_requests rr
		JOIN gold_transaction_ledger gl ON gl.gl_id = rr.rr_ledger_id
		WHERE rr.rr_tenant_id = $1 AND rr.rr_uuid = $2
		FOR UPDATE OF rr
	`
	rr := models.RedemptionRequest{UUID: rrUUID, TenantID: tenantID}
	err := tx.QueryRowContext(ctx, query, tenantID, rrUUID).Scan(
		&rr.ID, &rr.UserID, &rr.LedgerID, &rr.LedgerUUID, &rr.WeightGrams, &rr.Status, &rr.PickupCode,
		&rr.FailedCodeAttempts,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, interfaces.ErrRedemptionNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("failed to lock redemption: %w", err)
	}
	return &rr, nil
}

// RecordFailedCodeAttemptWithTX counts a wrong pickup code against the request and returns
// the new total. The caller commits it even though the collection fails.
func (r *RedemptionRepository) RecordFailedCodeAttemptWithTX(ctx context.Context, tx *sql.Tx, rrID int64) (int, error) {
	query := `
		UPDATE redemption_requests
		SET rr_failed_code_attempts = rr_failed_code_attempts + 1, rr_modified_at = NOW()
		WHERE rr_id = $1
		RETURNING rr_failed_code_attempts
	`
	var attempts int
	if err := tx.QueryRowContext(ctx, query, rrID).Scan(&attempts); err != nil {
		return 0, fmt.Errorf("failed to record pickup code attempt: %w", err)
	}
	return attempts, nil
}

// MarkCollectedWithTX records that staff handed the gold over at the counter.
func (r *RedemptionRepository) MarkCollectedWithTX(ctx context.Context, tx *sql.Tx, rrID int64, adminUUID string) error {
	query := `
		UPDATE redemption_requests
		SET rr_status = 'COLLECTED', rr_collected_at = NOW(), rr_modified_at = NOW(),
		    rr_collected_by = (SELECT tu_id FROM tenant_user_logins WHERE tu_uuid = $2::uuid)
		WHERE rr_id = $1 AND rr_status = 'PENDING'
	`
	return expectOneRow(tx.ExecContext(ctx, query, rrID, adminUUID))
}

// CancelPendingByLedgerWithTX cancels the PENDING request linked to a redemption
// ledger entry. It fails with ErrRedemptionNotPending if the gold was already collected.
func (r *RedemptionRepository) CancelPendingByLedgerWithTX(ctx context.Context, tx *sql.Tx, tenantID, ledgerID int64) error {
	query := `
		UPDATE redemption_requests
		SET rr_status = 'CANCELLED', rr_cancelled_at = NOW(), rr_modified_at = NOW()
		WHERE rr_tenant_id = $1 AND rr_ledger_id = $2 AND rr_status = 'PENDING'
	`
	return expectOneRow(tx.ExecContext(ctx, query, tenantID, ledgerID))
}

func expectOneRow(res sql.Result, err error) error {
	if err != nil {
		return fmt.Errorf("failed to update redemption: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to update redemption: %w", err)
	}
	if n == 0 {
		return interfaces.ErrRedemptionNotPending
	}
	return nil
}

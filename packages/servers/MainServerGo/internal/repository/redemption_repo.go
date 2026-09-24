package repository

import (
	"context"
	"database/sql"
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

func (r *RedemptionRepository) CreateRedemptionFulfillmentWithTX(ctx context.Context, tx *sql.Tx, f *models.RedemptionFulfillment) error {
	query := `
		INSERT INTO redemption_fulfillments (
			rf_tenant_id, rf_user_id, rf_ledger_id, rf_item_sku, rf_fulfillment_status, rf_shipping_detail_json
		) VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING rf_id, rf_uuid, rf_created_at
	`
	err := tx.QueryRowContext(ctx, query, f.TenantID, f.UserID, f.LedgerID, f.ItemSKU, f.FulfillmentStatus, f.ShippingDetailJSON).
		Scan(&f.ID, &f.UUID, &f.CreatedAt)
	if err != nil {
		return fmt.Errorf("failed to create redemption fulfillment: %w", err)
	}
	return nil
}

func (r *RedemptionRepository) GetPendingRedemptions(ctx context.Context, tenantID int64, limit, offset int) ([]*models.RedemptionFulfillment, error) {
	query := `
		SELECT rf_id, rf_uuid, rf_tenant_id, rf_user_id, rf_ledger_id, rf_item_sku, rf_fulfillment_status, rf_courier_name, rf_tracking_number, rf_shipping_detail_json, rf_created_at
		FROM redemption_fulfillments
		WHERE rf_tenant_id = $1 AND rf_fulfillment_status = 'PENDING'
		LIMIT $2 OFFSET $3
	`
	rows, err := r.DB.Db.QueryContext(ctx, query, tenantID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to get pending redemptions: %w", err)
	}
	defer rows.Close()

	var list []*models.RedemptionFulfillment
	for rows.Next() {
		var f models.RedemptionFulfillment
		if err := rows.Scan(
			&f.ID, &f.UUID, &f.TenantID, &f.UserID, &f.LedgerID, &f.ItemSKU, &f.FulfillmentStatus, &f.CourierName, &f.TrackingNumber, &f.ShippingDetailJSON, &f.CreatedAt,
		); err != nil {
			return nil, err
		}
		list = append(list, &f)
	}
	return list, nil
}

func (r *RedemptionRepository) FulfillRedemption(ctx context.Context, tenantID int64, uuid string, courier, tracking string) error {
	query := `
		UPDATE redemption_fulfillments 
		SET rf_fulfillment_status = 'SHIPPED', rf_courier_name = $1, rf_tracking_number = $2, rf_modified_at = NOW()
		WHERE rf_tenant_id = $3 AND rf_uuid = $4 AND rf_fulfillment_status = 'PENDING'
	`
	res, err := r.DB.Db.ExecContext(ctx, query, courier, tracking, tenantID, uuid)
	if err != nil {
		return fmt.Errorf("failed to fulfill redemption: %w", err)
	}
	if n, err := res.RowsAffected(); err == nil && n == 0 {
		return interfaces.ErrRedemptionNotPending
	}
	return nil
}

// CancelPendingByLedgerWithTX cancels the shipment linked to a redemption ledger
// entry. It fails if the shipment has already left PENDING (e.g. SHIPPED).
func (r *RedemptionRepository) CancelPendingByLedgerWithTX(ctx context.Context, tx *sql.Tx, tenantID, ledgerID int64) error {
	query := `
		UPDATE redemption_fulfillments
		SET rf_fulfillment_status = 'CANCELLED', rf_modified_at = NOW()
		WHERE rf_tenant_id = $1 AND rf_ledger_id = $2 AND rf_fulfillment_status = 'PENDING'
	`
	res, err := tx.ExecContext(ctx, query, tenantID, ledgerID)
	if err != nil {
		return fmt.Errorf("failed to cancel redemption fulfillment: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to cancel redemption fulfillment: %w", err)
	}
	if n == 0 {
		return interfaces.ErrRedemptionNotPending
	}
	return nil
}

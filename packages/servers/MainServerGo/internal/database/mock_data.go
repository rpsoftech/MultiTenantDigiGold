package database

import (
	"context"
	"database/sql"
	_ "embed"
	"encoding/json"
	"fmt"
)

// mockDataSQL is the local development and staging data: stores, staff, customers, trades
// and pickups. See the comment at the top of mock_data.sql.
//
//go:embed mock_data.sql
var mockDataSQL string

// mockPaymentKeyID is the placeholder Razorpay key the mock stores are created with.
const mockPaymentKeyID = "rzp_test_placeholder"

// LoadMockData inserts mock_data.sql in one transaction. Rows that already exist are left
// unchanged, so loading it twice changes nothing.
func LoadMockData(ctx context.Context, db *sql.DB) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.ExecContext(ctx, mockDataSQL); err != nil {
		return fmt.Errorf("failed to load mock data: %w", err)
	}
	return tx.Commit()
}

// SetMockPaymentKeys replaces the placeholder Razorpay keys of the mock stores with real
// test keys, so checkout works. Stores whose keys were already changed are left alone.
func SetMockPaymentKeys(ctx context.Context, db *sql.DB, keyID, keySecret, webhookSecret string) error {
	payment, err := json.Marshal(map[string]string{
		"provider_type":  "CUSTOM",
		"key_id":         keyID,
		"key_secret":     keySecret,
		"webhook_secret": webhookSecret,
	})
	if err != nil {
		return err
	}
	if _, err := db.ExecContext(ctx, `
		UPDATE tenant_internal_configs SET tic_payment_gateway_json = $1, tic_modified_at = NOW()
		WHERE tic_payment_gateway_json->>'key_id' = $2`, payment, mockPaymentKeyID); err != nil {
		return fmt.Errorf("failed to set mock payment keys: %w", err)
	}
	return nil
}

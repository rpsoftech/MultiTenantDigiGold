//go:build integration

package integration

import (
	"context"
	"database/sql"
	"fmt"
	"net/url"
	"os"
	"testing"

	"golang.org/x/crypto/bcrypt"

	"github.com/rpsoftech/DigiGold/MainServerGo/internal/database"
)

// The mock data (internal/database/mock_data.sql) must load on the current schema, twice
// without changing anything, and keep its books balanced the way the app keeps them. It is
// loaded into a schema of its own, apart from the data the other tests use.
func TestMockDataIsConsistent(t *testing.T) {
	ctx := context.Background()
	const schema = "mock_data_check"
	if err := database.ResetSchema(ctx, db, schema); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = db.Exec(fmt.Sprintf(`DROP SCHEMA IF EXISTS %q CASCADE`, schema)) })

	dsn := fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=disable&search_path=%s",
		url.QueryEscape(os.Getenv("PG_USERNAME")), url.QueryEscape(os.Getenv("PG_PASSWORD")),
		os.Getenv("PG_HOST"), os.Getenv("PG_PORT"), os.Getenv("PG_DATABASE"), schema)
	mock, err := sql.Open("pgx", dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer mock.Close()

	if err := database.MigrateUp(mock); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	for load := 1; load <= 2; load++ {
		if err := database.LoadMockData(ctx, mock); err != nil {
			t.Fatalf("load %d: %v", load, err)
		}
	}

	counts := map[string]int{
		"tenants": 4, "tenant_internal_configs": 4, "margin_configurations": 3,
		"tenant_user_logins": 6, "users": 5, "gold_transaction_ledger": 13, "redemption_requests": 5,
	}
	for table, want := range counts {
		var got int
		if err := mock.QueryRow(`SELECT COUNT(*) FROM ` + table).Scan(&got); err != nil {
			t.Fatal(err)
		}
		if got != want {
			t.Errorf("%s: %d rows after loading twice, want %d", table, got, want)
		}
	}

	// Each query counts the rows that break one rule.
	rules := map[string]string{
		"vault balance is the sum of the customer's ledger": `
			SELECT COUNT(*) FROM users u WHERE u.user_total_vault_balance <>
				COALESCE((SELECT SUM(gl_weight_grams) FROM gold_transaction_ledger WHERE gl_user_id = u.user_id), 0)`,
		"running balances add up in order": `
			SELECT COUNT(*) FROM (
				SELECT gl_running_gold_balance_grams AS running,
					SUM(gl_weight_grams) OVER (PARTITION BY gl_user_id ORDER BY gl_created_at, gl_id) AS total
				FROM gold_transaction_ledger) x
			WHERE running <> total OR running < 0`,
		"ledger entries belong to the customer's store": `
			SELECT COUNT(*) FROM gold_transaction_ledger l JOIN users u ON u.user_id = l.gl_user_id
			WHERE l.gl_tenant_id <> u.user_tenant_id`,
		"store unlifted grams are its customers' total": `
			SELECT COUNT(*) FROM margin_configurations m WHERE m.mc_tenant_unlifted_grams <>
				COALESCE((SELECT SUM(gl_weight_grams) FROM gold_transaction_ledger WHERE gl_tenant_id = m.mc_tenant_id), 0)`,
		"purchase price is MCX + margin + GST, total is weight x price": `
			SELECT COUNT(*) FROM gold_transaction_ledger WHERE gl_event_type = 'GOLD_PURCHASE' AND (
				gl_final_rate_per_gram <> gl_mcx_base_rate + gl_tenant_margin_applied + gl_gst_applied
				OR gl_total_amount_inr <> ROUND(gl_weight_grams * gl_final_rate_per_gram, 2))`,
		"a reversal undoes an earlier entry of the same customer": `
			SELECT COUNT(*) FROM gold_transaction_ledger r WHERE r.gl_event_type = 'SYSTEM_REVERSAL' AND NOT EXISTS (
				SELECT 1 FROM gold_transaction_ledger o
				WHERE r.gl_reference_id = 'REVERSAL_' || o.gl_uuid AND o.gl_user_id = r.gl_user_id
				  AND o.gl_weight_grams = -r.gl_weight_grams AND o.gl_created_at < r.gl_created_at)`,
		"a pickup matches its redemption entry, and only a cancelled one is reversed": `
			SELECT COUNT(*) FROM redemption_requests rr JOIN gold_transaction_ledger l ON l.gl_id = rr.rr_ledger_id
			WHERE l.gl_event_type <> 'PHYSICAL_REDEMPTION' OR rr.rr_weight_grams <> -l.gl_weight_grams
			   OR rr.rr_user_id <> l.gl_user_id OR rr.rr_tenant_id <> l.gl_tenant_id
			   OR (rr.rr_status = 'CANCELLED') <> EXISTS (
				SELECT 1 FROM gold_transaction_ledger r WHERE r.gl_reference_id = 'REVERSAL_' || l.gl_uuid)`,
		"platform exposure is the net of every trade": `
			SELECT COUNT(*) FROM master_hedging_state WHERE mhs_unhedged_grams <>
				(SELECT COALESCE(SUM(gl_weight_grams), 0) FROM gold_transaction_ledger)`,
		"decided KYC has a reviewer and date; submitted KYC has a date": `
			SELECT COUNT(*) FROM users WHERE
				(user_kyc_status IN ('verified', 'rejected') AND (user_kyc_decided_at IS NULL OR user_status_approved_by IS NULL))
				OR (user_document_json <> '{}'::jsonb AND user_kyc_submitted_at IS NULL)`,
	}
	for rule, query := range rules {
		var broken int
		if err := mock.QueryRow(query).Scan(&broken); err != nil {
			t.Fatalf("%s: %v", rule, err)
		}
		if broken != 0 {
			t.Errorf("%s: %d rows break it", rule, broken)
		}
	}

	// The documented sign-in works for every admin.
	rows, err := mock.Query(`SELECT tu_username, tu_password_hash, COALESCE(tu_totp_secret, ''), tu_is_totp_enabled FROM tenant_user_logins`)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	for rows.Next() {
		var username, hash, secret string
		var totpEnabled bool
		if err := rows.Scan(&username, &hash, &secret, &totpEnabled); err != nil {
			t.Fatal(err)
		}
		if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte("DigiGold@123")); err != nil {
			t.Errorf("%s: password DigiGold@123 does not match: %v", username, err)
		}
		if totpEnabled && secret != adminTOTPSecret {
			t.Errorf("%s: TOTP secret = %q, want the documented one", username, secret)
		}
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
}

// A reset clears the app's Redis keys (cached rows, sessions, locks) but nothing else in the
// Redis database, and refuses to run without a prefix rather than delete every key.
func TestClearCachedKeysOnlyDeletesTheAppPrefix(t *testing.T) {
	ctx := context.Background()
	const prefix, other = "clearCheck:", "otherApp:clearCheck"
	for _, key := range []string{prefix + "tenant/1", prefix + "auth:session", other} {
		if err := rdb.Set(ctx, key, "1", 0).Err(); err != nil {
			t.Fatal(err)
		}
	}
	t.Cleanup(func() { rdb.Del(context.Background(), other) })

	deleted, err := database.ClearCachedKeys(ctx, rdb, prefix)
	if err != nil || deleted != 2 {
		t.Fatalf("ClearCachedKeys = %d, %v; want 2 keys deleted", deleted, err)
	}
	if n := rdb.Exists(ctx, prefix+"tenant/1", prefix+"auth:session").Val(); n != 0 {
		t.Fatalf("%d prefixed keys left", n)
	}
	if rdb.Exists(ctx, other).Val() != 1 {
		t.Fatal("a key outside the prefix was deleted")
	}
	if _, err := database.ClearCachedKeys(ctx, rdb, ""); err == nil {
		t.Fatal("an empty prefix must be refused")
	}
}

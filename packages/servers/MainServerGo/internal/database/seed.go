package database

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"

	"github.com/redis/go-redis/v9"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/constants"
	"golang.org/x/crypto/bcrypt"
)

// Fixed IDs of the seed data. Integration tests and local tools use them.
const (
	SeedPlatformTenantUUID = "01900000-0000-7000-8000-000000000001"
	SeedDemoTenantUUID     = "01900000-0000-7000-8000-000000000002"
	SeedOtherTenantUUID    = "01900000-0000-7000-8000-000000000003"

	SeedPlatformAdminUUID = "01900000-0000-7000-8000-000000000101"
	SeedDemoManagerUUID   = "01900000-0000-7000-8000-000000000102"
	SeedOtherManagerUUID  = "01900000-0000-7000-8000-000000000103"

	SeedVerifiedCustomerUUID = "01900000-0000-7000-8000-000000000201"
	SeedPendingCustomerUUID  = "01900000-0000-7000-8000-000000000202"

	SeedPlatformAdminUsername = "platform-admin"
	SeedDemoManagerUsername   = "demo-manager"
	SeedOtherManagerUsername  = "other-manager"

	SeedVerifiedCustomerPhone = "9999900001"
	SeedPendingCustomerPhone  = "9999900002"

	// Demo store pricing: ₹100/g fixed margin + 3% GST, 1000 g B2B credit.
	SeedDemoMarginINR   = 100.0
	SeedDemoGSTPercent  = 3.0
	SeedDemoCreditGrams = 1000.0

	// Rate written to Redis only when no live feed has written one yet.
	SeedGoldAsk = 7000.0
	SeedGoldBid = 6950.0
)

// SeedOptions carries the secrets the seed writes. They come from the
// environment so real keys never live in the repository.
type SeedOptions struct {
	AdminPassword         string // password of every seeded admin
	AdminTOTPSecret       string // base32 TOTP secret of every seeded admin
	RazorpayKeyID         string
	RazorpayKeySecret     string
	RazorpayWebhookSecret string
}

// Seed inserts local development and test data. It is idempotent: rows that
// already exist (matched by their fixed UUIDs) are left unchanged.
func Seed(ctx context.Context, db *sql.DB, rdb *redis.Client, opts SeedOptions) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(opts.AdminPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash seed password: %w", err)
	}

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Tenants. "default" is the platform tenant: the event consumer loads its
	// config as the fallback (e.g. WhatsApp credentials) for every store.
	platformID, err := seedTenant(ctx, tx, SeedPlatformTenantUUID, "DigiGold Platform", "default", "platform")
	if err != nil {
		return err
	}
	demoID, err := seedTenant(ctx, tx, SeedDemoTenantUUID, "Demo Jewellers", "demo", "demo")
	if err != nil {
		return err
	}
	otherID, err := seedTenant(ctx, tx, SeedOtherTenantUUID, "Other Jewellers", "other", "other")
	if err != nil {
		return err
	}

	payment, _ := json.Marshal(map[string]string{
		"provider_type":  "CUSTOM",
		"key_id":         opts.RazorpayKeyID,
		"key_secret":     opts.RazorpayKeySecret,
		"webhook_secret": opts.RazorpayWebhookSecret,
	})
	for _, t := range []struct {
		id      int64
		uuid    string
		payment []byte
	}{
		{platformID, "01900000-0000-7000-8000-000000000301", []byte("{}")},
		{demoID, "01900000-0000-7000-8000-000000000302", payment},
		{otherID, "01900000-0000-7000-8000-000000000303", payment},
	} {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO tenant_internal_configs (tic_uuid, tic_tenant_id, tic_payment_gateway_json)
			VALUES ($1, $2, $3)
			ON CONFLICT (tic_tenant_id) DO NOTHING`, t.uuid, t.id, t.payment); err != nil {
			return fmt.Errorf("failed to seed tenant config: %w", err)
		}
	}

	for _, id := range []int64{demoID, otherID} {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO margin_configurations (
				mc_tenant_id, mc_commodity_type, mc_sell_margin_type, mc_sell_margin_value,
				mc_is_gst_enabled, mc_gst_percentage, mc_tenant_credit_limit_grams
			) VALUES ($1, 'GOLD', 'FIXED_INR', $2, TRUE, $3, $4)
			ON CONFLICT (mc_tenant_id, mc_commodity_type) DO NOTHING`,
			id, SeedDemoMarginINR, SeedDemoGSTPercent, SeedDemoCreditGrams); err != nil {
			return fmt.Errorf("failed to seed margin: %w", err)
		}
	}

	// Admins. TOTP is already enabled with a known secret so tools and tests can log in.
	for _, a := range []struct {
		uuid, username, phone, role string
		tenantID                    int64
	}{
		{SeedPlatformAdminUUID, SeedPlatformAdminUsername, "9000000001", "super_admin", platformID},
		{SeedDemoManagerUUID, SeedDemoManagerUsername, "9000000002", "manager", demoID},
		{SeedOtherManagerUUID, SeedOtherManagerUsername, "9000000003", "manager", otherID},
	} {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO tenant_user_logins (
				tu_uuid, tu_tenant_id, tu_username, tu_phone_number, tu_password_hash,
				tu_totp_secret, tu_is_totp_enabled, tu_role
			) VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7)
			ON CONFLICT (tu_uuid) DO NOTHING`,
			a.uuid, a.tenantID, a.username, a.phone, string(hash), opts.AdminTOTPSecret, a.role); err != nil {
			return fmt.Errorf("failed to seed admin %s: %w", a.username, err)
		}
	}

	// Customers of the demo store.
	for _, u := range []struct {
		uuid, phone, name, kyc string
	}{
		{SeedVerifiedCustomerUUID, SeedVerifiedCustomerPhone, "Verified Customer", "verified"},
		{SeedPendingCustomerUUID, SeedPendingCustomerPhone, "Pending Customer", "pending"},
	} {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO users (user_uuid, user_tenant_id, user_full_name, user_phone_number, user_kyc_status)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (user_uuid) DO NOTHING`,
			u.uuid, demoID, u.name, u.phone, u.kyc); err != nil {
			return fmt.Errorf("failed to seed customer %s: %w", u.phone, err)
		}
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	// A starting rate, so buys work before the live feed runs. Never overwrites a live rate.
	if rdb != nil {
		rate, _ := json.Marshal(map[string]float64{
			"ask": SeedGoldAsk, "bid": SeedGoldBid, "last-high": SeedGoldAsk, "last-low": SeedGoldBid,
		})
		if err := rdb.HSetNX(ctx, constants.RedisKeyLatestRawRate, "GOLD", string(rate)).Err(); err != nil {
			return fmt.Errorf("failed to seed live rate: %w", err)
		}
	}

	log.Printf("✅ Seeded tenants (platform=%s, demo=%s, other=%s), 3 admins and 2 customers",
		SeedPlatformTenantUUID, SeedDemoTenantUUID, SeedOtherTenantUUID)
	return nil
}

func seedTenant(ctx context.Context, tx *sql.Tx, uuid, name, shortName, subdomain string) (int64, error) {
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO tenants (tenant_uuid, tenant_full_name, tenant_short_name, tenant_subdomain)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (tenant_uuid) DO NOTHING`, uuid, name, shortName, subdomain); err != nil {
		return 0, fmt.Errorf("failed to seed tenant %s: %w", shortName, err)
	}
	var id int64
	if err := tx.QueryRowContext(ctx, `SELECT tenant_id FROM tenants WHERE tenant_uuid = $1`, uuid).Scan(&id); err != nil {
		return 0, fmt.Errorf("failed to read tenant %s: %w", shortName, err)
	}
	return id, nil
}

package database

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// PlatformTenantShortName is the platform tenant's short name. The event consumer loads its
// config as the fallback for every store (e.g. the DEFAULT WhatsApp provider), and platform
// staff (super_admin) sign in under it.
const PlatformTenantShortName = "default"

// minBootstrapPasswordLength: the first super_admin can act on every store.
const minBootstrapPasswordLength = 12

// BootstrapOptions is the first platform admin. The password comes from the environment and
// is stored only as a bcrypt hash.
type BootstrapOptions struct {
	AdminUsername string
	AdminPhone    string
	AdminPassword string
}

// BootstrapResult says what Bootstrap found or created.
type BootstrapResult struct {
	PlatformTenantUUID string
	TenantCreated      bool
	AdminCreated       bool // false when a super_admin already existed
}

func (o BootstrapOptions) validate() error {
	var missing []string
	if strings.TrimSpace(o.AdminUsername) == "" {
		missing = append(missing, "BOOTSTRAP_ADMIN_USERNAME")
	}
	if strings.TrimSpace(o.AdminPhone) == "" {
		missing = append(missing, "BOOTSTRAP_ADMIN_PHONE")
	}
	if o.AdminPassword == "" {
		missing = append(missing, "BOOTSTRAP_ADMIN_PASSWORD")
	}
	if len(missing) > 0 {
		return fmt.Errorf("bootstrap needs %s", strings.Join(missing, ", "))
	}
	if len(o.AdminPassword) < minBootstrapPasswordLength {
		return fmt.Errorf("BOOTSTRAP_ADMIN_PASSWORD must be at least %d characters", minBootstrapPasswordLength)
	}
	return nil
}

// Bootstrap prepares an empty (e.g. production) database: the platform tenant with an empty
// internal config, and one super_admin if the platform has none. It is idempotent and,
// unlike Seed, writes no demo data, so it is safe in PRODUCTION. The admin signs in with the
// password and sets up TOTP on first login.
func Bootstrap(ctx context.Context, db *sql.DB, opts BootstrapOptions) (*BootstrapResult, error) {
	if err := opts.validate(); err != nil {
		return nil, err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(opts.AdminPassword), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash admin password: %w", err)
	}

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	result := &BootstrapResult{}

	// 1. The platform tenant.
	var tenantID int64
	err = tx.QueryRowContext(ctx,
		`SELECT tenant_id, tenant_uuid::text FROM tenants WHERE tenant_short_name = $1`, PlatformTenantShortName,
	).Scan(&tenantID, &result.PlatformTenantUUID)
	if errors.Is(err, sql.ErrNoRows) {
		err = tx.QueryRowContext(ctx, `
			INSERT INTO tenants (tenant_full_name, tenant_short_name, tenant_subdomain)
			VALUES ('DigiGold Platform', $1, 'platform')
			RETURNING tenant_id, tenant_uuid::text`, PlatformTenantShortName,
		).Scan(&tenantID, &result.PlatformTenantUUID)
		result.TenantCreated = err == nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to create platform tenant: %w", err)
	}

	// 2. Its internal config (WhatsApp and payment settings are filled in later by an admin).
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO tenant_internal_configs (tic_uuid, tic_tenant_id) VALUES ($1, $2)
		ON CONFLICT (tic_tenant_id) DO NOTHING`, uuid.NewString(), tenantID); err != nil {
		return nil, fmt.Errorf("failed to create platform config: %w", err)
	}

	// 3. The first super_admin, unless the platform already has one.
	var hasSuperAdmin bool
	if err := tx.QueryRowContext(ctx, `
		SELECT EXISTS (SELECT 1 FROM tenant_user_logins WHERE tu_tenant_id = $1 AND tu_role = 'super_admin')`,
		tenantID).Scan(&hasSuperAdmin); err != nil {
		return nil, fmt.Errorf("failed to check for a super_admin: %w", err)
	}
	if !hasSuperAdmin {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO tenant_user_logins (
				tu_uuid, tu_tenant_id, tu_username, tu_phone_number, tu_password_hash,
				tu_is_totp_enabled, tu_role, tu_is_active
			) VALUES ($1, $2, $3, $4, $5, FALSE, 'super_admin', TRUE)`,
			uuid.NewString(), tenantID, strings.TrimSpace(opts.AdminUsername), strings.TrimSpace(opts.AdminPhone),
			string(hash)); err != nil {
			return nil, fmt.Errorf("failed to create super_admin: %w", err)
		}
		result.AdminCreated = true
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return result, nil
}

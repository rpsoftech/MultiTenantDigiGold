DROP INDEX IF EXISTS idx_rr_tenant_collected;
ALTER TABLE redemption_requests DROP COLUMN IF EXISTS rr_failed_code_attempts;

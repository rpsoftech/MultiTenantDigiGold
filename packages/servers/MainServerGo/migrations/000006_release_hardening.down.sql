ALTER TABLE tenant_user_logins DROP CONSTRAINT IF EXISTS uq_tu_tenant_username;
ALTER TABLE tenant_kyc_documents
    DROP COLUMN IF EXISTS tkd_modified_at,
    DROP COLUMN IF EXISTS tkd_status,
    DROP COLUMN IF EXISTS tkd_uuid;
ALTER TABLE tenants DROP COLUMN IF EXISTS tenant_is_active;
DROP INDEX IF EXISTS uq_gl_tenant_reference;

-- 1. A payment, counter quote or reversal may be recorded in the ledger only once. Online
-- payments relied on a 24-hour Redis lock alone, so a late or replayed Razorpay webhook could
-- credit (or refund) a payment twice. Physical redemptions carry an empty reference and are
-- left out. Fails if duplicates already exist; find them with:
--   SELECT gl_tenant_id, gl_reference_id, COUNT(*) FROM gold_transaction_ledger
--   WHERE gl_reference_id <> '' GROUP BY 1, 2 HAVING COUNT(*) > 1;
CREATE UNIQUE INDEX uq_gl_tenant_reference ON gold_transaction_ledger (gl_tenant_id, gl_reference_id)
    WHERE gl_reference_id IS NOT NULL AND gl_reference_id <> '';

-- 2. A store can be suspended: its customers and staff are refused until it is reactivated.
ALTER TABLE tenants ADD COLUMN tenant_is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- 3. Columns the tenant KYC repository has always used but the schema never had.
ALTER TABLE tenant_kyc_documents
    ADD COLUMN tkd_uuid UUID NOT NULL UNIQUE DEFAULT uuidv7(),
    ADD COLUMN tkd_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (tkd_status IN ('PENDING', 'VERIFIED', 'REJECTED')),
    ADD COLUMN tkd_modified_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 4. Admin login looks staff up by username within a store, so a username must be unique
-- there. Fails if duplicates already exist; find them with:
--   SELECT tu_tenant_id, tu_username, COUNT(*) FROM tenant_user_logins
--   GROUP BY 1, 2 HAVING COUNT(*) > 1;
ALTER TABLE tenant_user_logins ADD CONSTRAINT uq_tu_tenant_username UNIQUE (tu_tenant_id, tu_username);

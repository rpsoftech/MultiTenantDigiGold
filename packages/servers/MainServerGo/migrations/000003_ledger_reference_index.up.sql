-- Reversals point at the entry they reverse through gl_reference_id ('REVERSAL_<gl_uuid>').
-- The store ledger and analytics look that reference up for every entry, so index it.
CREATE INDEX IF NOT EXISTS idx_ledger_tenant_reference ON gold_transaction_ledger(gl_tenant_id, gl_reference_id);

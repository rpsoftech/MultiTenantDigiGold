-- Migration: trade and tenancy fixes (2026-09-24)
--
-- 1. Adds the GOLD_SELL ledger event type. Customer sells were stored as
--    PHYSICAL_REDEMPTION before; those old rows are NOT rewritten, because a
--    past sell cannot be told apart from a redemption without its
--    redemption_fulfillments row. Rows without one are sells:
--    see the optional backfill at the end.
-- 2. Downgrades the root admin of every store from super_admin to manager.
--    super_admin lets an admin act on ANY tenant, so it must be held only by
--    platform staff.
--
-- Before running, set platform_tenant_id below to the tenant that holds your
-- platform staff. Its admins keep super_admin.
--
-- ALTER TYPE ... ADD VALUE cannot be used in the same transaction that adds it,
-- so step 1 runs on its own, outside the transaction.

ALTER TYPE ledger_event_type_enum ADD VALUE IF NOT EXISTS 'GOLD_SELL' AFTER 'GOLD_PURCHASE';

BEGIN;

DO $$
DECLARE
    platform_tenant_id BIGINT := NULL; -- SET THIS before running
BEGIN
    IF platform_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Set platform_tenant_id in this migration before running it';
    END IF;

    UPDATE tenant_user_logins
    SET tu_role = 'manager', tu_modified_at = NOW()
    WHERE tu_role = 'super_admin'
      AND tu_tenant_id <> platform_tenant_id;
END $$;

-- Optional backfill: relabel past customer sells (debits with no shipment).
-- UPDATE gold_transaction_ledger gl
-- SET gl_event_type = 'GOLD_SELL'
-- WHERE gl.gl_event_type = 'PHYSICAL_REDEMPTION'
--   AND NOT EXISTS (SELECT 1 FROM redemption_fulfillments rf WHERE rf.rf_ledger_id = gl.gl_id);

COMMIT;

-- Reverts 000001_init. Drops every object it created. All data is lost.
DROP TABLE IF EXISTS redemption_requests;
DROP TABLE IF EXISTS master_hedging_orders;
DROP TABLE IF EXISTS master_hedging_state;
DROP TABLE IF EXISTS gold_transaction_ledger;
DROP TABLE IF EXISTS margin_configurations;
DROP TABLE IF EXISTS tenant_kyc_documents;
DROP TABLE IF EXISTS tenant_internal_configs;
DROP TABLE IF EXISTS system_events CASCADE;
DROP FUNCTION IF EXISTS ensure_system_events_partitions(INT);
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS tenant_user_logins;
DROP TABLE IF EXISTS tenants;
DROP TYPE IF EXISTS hedge_order_status_enum;
DROP TYPE IF EXISTS ledger_event_type_enum;
DROP TYPE IF EXISTS payment_mode_enum;
DROP TYPE IF EXISTS margin_unit_enum;
DROP TYPE IF EXISTS doc_type_enum;

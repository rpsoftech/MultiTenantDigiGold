package schema

// Centralized Table Names
const (
	TableSystemEvents     = "system_events"
	TableTenants          = "tenants"
	TableUsers            = "users"
	TableTenantUserLogins = "tenant_user_logins"
	TableTenantConfigs    = "tenant_internal_configs"
	// New Master Admin, Ledger & Hedging Tables
	TableTenantKYCDocuments     = "tenant_kyc_documents"
	TableMarginConfigs          = "margin_configurations"
	TableGoldTransactionLedger  = "gold_transaction_ledger"
	TableRedemptionFulfillments = "redemption_fulfillments"
	TableMasterHedgingState     = "master_hedging_state"
	TableMasterHedgingOrders    = "master_hedging_orders"
)

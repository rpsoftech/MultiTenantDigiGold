package schema

// ==========================================
// MASTER COLUMN REGISTRY
// ==========================================

// ------------------------------------------
// 1. system_events
// ------------------------------------------
const (
	ColEventId               = "event_id"
	ColKeyId                 = "key_id"
	ColTenantId              = "tenant_id"
	ColEventName             = "event_name"
	ColIsProcessed           = "is_processed"
	ColParentNames           = "parent_names"
	ColPayload               = "payload"
	ColIpAddressOccurredFrom = "ip_address_occurred_from"
	ColAdminId               = "admin_id"
	ColOccurredAt            = "occurred_at"
)

// ------------------------------------------
// 2. tenants
// ------------------------------------------
const (
	ColTenantID               = "tenant_id"
	ColTenantUUID             = "tenant_uuid"
	ColTenantFullName         = "tenant_full_name"
	ColTenantShortName        = "tenant_short_name"
	ColTenantDomain           = "tenant_domain"
	ColTenantSubdomain        = "tenant_subdomain"
	ColTenantDomainExpiry     = "tenant_domain_expiry"
	ColTenantPlanExpiry       = "tenant_plan_expiry"
	ColTenantRenewalCost      = "tenant_renewal_cost"
	ColTenantKYCMode          = "tenant_kyc_mode"
	ColTenantMarkupPercentage = "tenant_markup_percentage"
	ColTenantUIJSONConfig     = "tenant_ui_json_config"
	ColTenantCreatedAt        = "tenant_created_at"
	ColTenantModifiedAt       = "tenant_modified_at"
)

// ------------------------------------------
// 3. users
// ------------------------------------------
const (
	ColUserID               = "user_id"
	ColUserUUID             = "user_uuid"
	ColUserTenantID         = "user_tenant_id"
	ColUserFullName         = "user_full_name"
	ColUserPhoneNumber      = "user_phone_number"
	ColUserEmailID          = "user_email_id"
	ColUserKYCStatus        = "user_kyc_status"
	ColUserStatusApprovedBy = "user_status_approved_by"
	ColUserDocumentJSON     = "user_document_json"
	ColUserERPUniqueID      = "user_erp_unique_id"
	ColUserVaultBalance     = "user_total_vault_balance"
	ColUserCreatedAt        = "user_created_at"
	ColUserModifiedAt       = "user_modified_at"
)

// ------------------------------------------
// 4. tenant_user_logins (Admin/Staff)
// ------------------------------------------
const (
	ColTUID              = "tu_id"
	ColTUUID             = "tu_uuid"
	ColTUTenantID        = "tu_tenant_id"
	ColTUUsername        = "tu_username"
	ColTUPhoneNumber     = "tu_phone_number"
	ColTUPasswordHash    = "tu_password_hash"
	ColTURole            = "tu_role"
	ColTUIsActive        = "tu_is_active"
	ColTUTOTPSecret      = "tu_totp_secret"
	ColTUTOTPEnabled     = "tu_is_totp_enabled"
	ColTUPermissionsJSON = "tu_permissions_json"
	ColTUCreatedAt       = "tu_created_at"
	ColTUModifiedAt      = "tu_modified_at"
)

// ------------------------------------------
// 5. tenant_internal_configs
// ------------------------------------------
const (
	ColTICId                 = "tic_id"
	ColTICUUID               = "tic_uuid"
	ColTICTenantID           = "tic_tenant_id"
	ColTICWhatsappJSON       = "tic_whatsapp_json"
	ColTICPaymentGatewayJSON = "tic_payment_gateway_json"
	ColTICOthersJSON         = "tic_other_json"
	ColTICCreatedAt          = "tic_created_at"
	ColTICModifiedAt         = "tic_modified_at"
)

// ------------------------------------------
// 6. tenant_kyc_documents
// ------------------------------------------
const (
	ColTKDID             = "tkd_id"
	ColTKDUUID           = "tkd_uuid"
	ColTKDTenantID       = "tkd_tenant_id"
	ColTKDDocumentType   = "tkd_document_type"
	ColTKDDocumentURL    = "tkd_document_url"
	ColTKDDocumentNumber = "tkd_document_number"
	ColTKDStatus         = "tkd_status"
	ColTKDVerifiedBy     = "tkd_verified_by"
	ColTKDVerifiedAt     = "tkd_verified_at"
	ColTKDCreatedAt      = "tkd_created_at"
	ColTKDModifiedAt     = "tkd_modified_at"
)

// ------------------------------------------
// 7. margin_configurations
// ------------------------------------------
const (
	ColMCID                     = "mc_id"
	ColMCUUID                   = "mc_uuid"
	ColMCTenantID               = "mc_tenant_id"
	ColMCCommodityType          = "mc_commodity_type"
	ColMCSellMarginType         = "mc_sell_margin_type"
	ColMCSellMarginValue        = "mc_sell_margin_value"
	ColMCIsGSTEnabled           = "mc_is_gst_enabled"
	ColMCGSTPercentage          = "mc_gst_percentage"
	ColMCTenantCreditLimitGrams = "mc_tenant_credit_limit_grams"
	ColMCTenantUnliftedGrams    = "mc_tenant_unlifted_grams"
	ColMCIsActive               = "mc_is_active"
	ColMCCreatedAt              = "mc_created_at"
	ColMCModifiedAt             = "mc_modified_at"
)

// ------------------------------------------
// 8. gold_transaction_ledger
// ------------------------------------------
const (
	ColGLID                      = "gl_id"
	ColGLUUID                    = "gl_uuid"
	ColGLTenantID                = "gl_tenant_id"
	ColGLUserID                  = "gl_user_id"
	ColGLEventType               = "gl_event_type"
	ColGLPaymentMode             = "gl_payment_mode"
	ColGLWeightGrams             = "gl_weight_grams"
	ColGLTotalAmountINR          = "gl_total_amount_inr"
	ColGLRunningGoldBalanceGrams = "gl_running_gold_balance_grams"
	ColGLMCXBaseRate             = "gl_mcx_base_rate"
	ColGLMasterMarginApplied     = "gl_master_margin_applied"
	ColGLTenantMarginApplied     = "gl_tenant_margin_applied"
	ColGLGSTApplied              = "gl_gst_applied"
	ColGLFinalRatePerGram        = "gl_final_rate_per_gram"
	ColGLReferenceID             = "gl_reference_id"
	ColGLMetadataJSON            = "gl_metadata_json"
	ColGLCreatedAt               = "gl_created_at"
	ColGLModifiedAt              = "gl_modified_at"
)

// ------------------------------------------
// 9. redemption_fulfillments
// ------------------------------------------
const (
	ColRFID                 = "rf_id"
	ColRFUUID               = "rf_uuid"
	ColRFLedgerID           = "rf_ledger_id"
	ColRFTenantID           = "rf_tenant_id"
	ColRFUserID             = "rf_user_id"
	ColRFItemSKU            = "rf_item_sku"
	ColRFFulfillmentStatus  = "rf_fulfillment_status"
	ColRFCourierName        = "rf_courier_name"
	ColRFTrackingNumber     = "rf_tracking_number"
	ColRFShippingDetailJSON = "rf_shipping_detail_json"
	ColRFIsExported         = "rf_is_exported"
	ColRFExportedAt         = "rf_exported_at"
	ColRFCreatedAt          = "rf_created_at"
	ColRFModifiedAt         = "rf_modified_at"
)

// ------------------------------------------
// 10. master_hedging_state
// ------------------------------------------
const (
	ColMHSID               = "mhs_id"
	ColMHSUnhedgedGrams    = "mhs_unhedged_grams"
	ColMHSTotalHedgedGrams = "mhs_total_hedged_grams"
	ColMHSLastHedgedAt     = "mhs_last_hedged_at"
	ColMHSCreatedAt        = "mhs_created_at"
	ColMHSModifiedAt       = "mhs_modified_at"
)

// ------------------------------------------
// 11. master_hedging_orders
// ------------------------------------------
const (
	ColMHOID               = "mho_id"
	ColMHOUUID             = "mho_uuid"
	ColMHOLotWeightGrams   = "mho_lot_weight_grams"
	ColMHOLPExecutionRate  = "mho_lp_execution_rate"
	ColMHOLPTotalAmountINR = "mho_lp_total_amount_inr"
	ColMHOStatus           = "mho_status"
	ColMHOLPOrderReference = "mho_lp_order_reference"
	ColMHOErrorLog         = "mho_error_log"
	ColMHOCreatedAt        = "mho_created_at"
	ColMHOCompletedAt      = "mho_completed_at"
	ColMHOModifiedAt       = "mho_modified_at"
)

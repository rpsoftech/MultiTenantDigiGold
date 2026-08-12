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
	ColUserVaultBalance     = "user_vault_balance"
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
	ColTICWebhookJSON        = "tic_webhook_json"
	ColTICCreatedAt          = "tic_created_at"
	ColTICModifiedAt         = "tic_modified_at"
)

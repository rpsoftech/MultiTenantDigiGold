package schema

// Tenants Columns
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

// Users Columns
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

// Tenant User Logins (Admin Staff) Columns
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

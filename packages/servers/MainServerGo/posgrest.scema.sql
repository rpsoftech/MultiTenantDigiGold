
CREATE TABLE tenants (
    -- The internal ID for fast SQL JOINs
	tenant_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    
    -- The public ID exposed in REST APIs and frontend URLs
    tenant_uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    
    -- Branding & Identification
    tenant_full_name VARCHAR(255) NOT NULL,
    tenant_short_name VARCHAR(100) UNIQUE,
    tenant_domain VARCHAR(255) UNIQUE,
    tenant_subdomain VARCHAR(100) UNIQUE,
    
    -- Billing & Expirations
    tenant_domain_expiry TIMESTAMP WITH TIME ZONE,
    tenant_plan_expiry TIMESTAMP WITH TIME ZONE,
    tenant_renewal_cost DECIMAL(10,2) DEFAULT 0.00,
    
    -- Platform Configurations
    tenant_kyc_mode VARCHAR(20) CHECK (tenant_kyc_mode IN ('upfront', 'just_in_time')) DEFAULT 'just_in_time',
    tenant_markup_percentage DECIMAL(5,2) DEFAULT 0.00,
    tenant_ui_json_config JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    tenant_created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    tenant_modified_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tenant_user_logins (
    -- Internal ID for fast SQL JOINs
    tu_id BIGSERIAL PRIMARY KEY, 
    
    -- Public ID exposed in REST APIs
    tu_uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    
    -- Foreign Key mapping strictly to the tenant's internal ID
    tu_tenant_id BIGINT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Basic Identification & Credentials
    tu_username VARCHAR(255) NOT NULL,
    tu_phone_number VARCHAR(15) NOT NULL,
    tu_password_hash VARCHAR(255) NOT NULL, -- Storing the securely hashed password
    
    -- Role & State Management
    tu_role VARCHAR(50) CHECK (tu_role IN ('super_admin', 'manager', 'custom')) DEFAULT 'manager',
    tu_is_active BOOLEAN DEFAULT true, -- Allows toggling login access instantly
    
    -- Granular Permissions Engine
    -- Example Payload: {"ecommerce": {"read": true, "write": false}, "kyc": {"read": true, "write": true, "delete": false}}
    tu_permissions_json JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    tu_created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    tu_modified_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraint: A phone number can only exist once PER retail shop owner (tenant)
    CONSTRAINT unique_tenant_admin_phone UNIQUE (tu_tenant_id, tu_phone_number)
);

CREATE INDEX idx_tu_login_lookup ON tenant_user_logins(tu_tenant_id, tu_phone_number, tu_is_active);
CREATE TABLE users (
    -- Internal ID for fast SQL JOINs
    user_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    
    -- Public ID exposed in REST APIs and frontend URLs
    user_uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    
    -- Foreign Key mapping strictly to the tenant's internal ID
    user_tenant_id BIGINT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Basic Identification
    user_full_name VARCHAR(255),
    user_phone_number VARCHAR(15) NOT NULL,
    user_email_id VARCHAR(255),
    
    -- KYC & Compliance 
    user_kyc_status VARCHAR(20) CHECK (user_kyc_status IN ('pending', 'verified', 'rejected')) DEFAULT 'pending',
    user_status_approved_by BIGINT NOT NULL REFERENCES tenant_user_logins(tu_id) ON DELETE CASCADE,
    user_document_json JSONB DEFAULT '{}'::jsonb,
    
    -- Future-Proofing (E-Commerce/Offline Integration)
    user_erp_unique_id VARCHAR(100),
    
    -- Financial Ledger
    user_total_vault_balance DECIMAL(14,4) DEFAULT 0.0000,
    
    -- Timestamps
    user_created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    user_modified_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints to ensure data integrity per retail shop
    CONSTRAINT unique_tenant_user_phone UNIQUE (user_tenant_id, user_phone_number),
    CONSTRAINT unique_tenant_user_erp UNIQUE (user_tenant_id, user_erp_unique_id)
);
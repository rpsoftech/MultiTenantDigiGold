
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
    user_status_approved_by BIGINT REFERENCES tenant_user_logins(tu_id) ON DELETE CASCADE,
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

-- Create the Master Table (Partitioned by Date)
CREATE TABLE system_events (
    event_id VARCHAR(36) NOT NULL,                  -- Maps to Id / ObjId
    key_id VARCHAR(255),                            -- Maps to KeyId
    tenant_id VARCHAR(255) NOT NULL,                -- Maps to TenantId (String based on your struct)
    event_name VARCHAR(100) NOT NULL,               -- Maps to EventName
    is_processed BOOLEAN DEFAULT FALSE,             -- Maps to IsProcessed
    parent_names TEXT[],                            -- Maps to ParentNames (PostgreSQL Array)
    payload JSONB NOT NULL,                         -- Maps to Payload interface{}
    ip_address_occurred_from VARCHAR(45),           -- Maps to IpAddressAOccurredFrom (45 chars for IPv6)
    admin_id VARCHAR(36),                           -- Maps to AdminId
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,  -- Maps to OccurredAt

    PRIMARY KEY (event_id, occurred_at)
) PARTITION BY RANGE (occurred_at);

-- 1. GIN Index: Allows you to instantly search inside the dynamic JSONB payload
CREATE INDEX idx_system_events_payload ON system_events USING GIN (payload);

-- 2. Tenant Index: For fetching audit logs strictly isolated to a specific retailer
CREATE INDEX idx_system_events_tenant ON system_events (tenant_id, occurred_at);

-- 3. The "Outbox" Partial Index: CRITICAL for background workers. 
-- This index ONLY stores rows where is_processed is false, making queue lookups take <1 millisecond.
CREATE INDEX idx_system_events_unprocessed ON system_events (is_processed) WHERE is_processed = false;

-- Create the partitions for the current and upcoming months
CREATE TABLE system_events_2026_07 PARTITION OF system_events
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

CREATE TABLE system_events_2026_08 PARTITION OF system_events
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

CREATE TABLE tenant_internal_configs (
    tic_id BIGSERIAL PRIMARY KEY,                     -- Internal fast joining ID
    tic_uuid VARCHAR(36) UNIQUE NOT NULL,             -- Public-facing UUID
    tic_tenant_id BIGINT UNIQUE NOT NULL,             -- 1:1 relationship with tenants table
    
    -- JSONB Configuration Columns
    tic_whatsapp_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    tic_payment_gateway_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    tic_other_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Standard Timestamps
    tic_created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    tic_modified_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Key Constraint (Strict relation to the main tenant)
    CONSTRAINT fk_tic_tenant FOREIGN KEY (tic_tenant_id) REFERENCES tenants(tenant_id) ON DELETE RESTRICT
);

-- Index for lightning-fast lookups when the worker needs credentials
CREATE INDEX idx_tic_tenant_id ON tenant_internal_configs(tic_tenant_id);

-- 1. Tenant KYC & Documentation
-- CREATE TYPE kyc_status_enum AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');
CREATE TYPE doc_type_enum AS ENUM ('PAN', 'GST_CERTIFICATE', 'BUSINESS_REGISTRATION', 'DIRECTOR_ID');

CREATE TABLE tenant_kyc_documents (
    tkd_id BIGSERIAL PRIMARY KEY,
    tkd_tenant_id BIGINT REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    tkd_document_type doc_type_enum NOT NULL,
    tkd_document_url TEXT NOT NULL,
    tkd_document_number VARCHAR(100),
    tkd_verified_by BIGINT,
    tkd_verified_at TIMESTAMPTZ,
    tkd_created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Dynamic Margin & Tax Configurations
CREATE TYPE margin_unit_enum AS ENUM ('PERCENTAGE', 'FIXED_INR');

CREATE TABLE margin_configurations (
    mc_id BIGSERIAL PRIMARY KEY,
    mc_tenant_id BIGINT REFERENCES tenants(tenant_id) ON DELETE CASCADE, -- ID 1 / Master Tenant = Global Base
    mc_commodity_type VARCHAR(20) DEFAULT 'GOLD', -- GOLD, SILVER, PLATINUM, etc.
    mc_sell_margin_type margin_unit_enum NOT NULL DEFAULT 'FIXED_INR',
    mc_sell_margin_value NUMERIC(10, 4) NOT NULL DEFAULT 0.0000,
    mc_is_gst_enabled BOOLEAN DEFAULT TRUE,
    mc_gst_percentage NUMERIC(5, 2) DEFAULT 3.00,
    mc_is_active BOOLEAN DEFAULT TRUE,
    mc_updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_tenant_commodity UNIQUE (mc_tenant_id, mc_commodity_type)
);
-- 1. Payment Modes for Omnichannel Support
CREATE TYPE payment_mode_enum AS ENUM (
    'ONLINE_PG',       -- User paid via Razorpay/PhonePe directly on their phone
    'COUNTER_CASH',    -- User paid cash at the retail shop
    'COUNTER_UPI',     -- User scanned the shop's local UPI QR
    'NONE'             -- Used for redemptions or system adjustments where no money changes hands
);

CREATE TYPE ledger_event_type_enum AS ENUM (
    'GOLD_PURCHASE',       
    'PHYSICAL_REDEMPTION', 
    'SYSTEM_REVERSAL',     
    'ADMIN_ADJUSTMENT'     
);

-- 2. Signed Unified Gold Ledger
CREATE TABLE gold_transaction_ledger (
    gl_id BIGSERIAL PRIMARY KEY,                                      
    gl_external_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),    

    gl_tenant_id BIGINT NOT NULL REFERENCES tenants(tenant_id),
    gl_user_id BIGINT NOT NULL,
    
    gl_event_type ledger_event_type_enum NOT NULL,
    gl_payment_mode payment_mode_enum NOT NULL, -- Tracks HOW the purchase was funded
    
    -- SIGNED METRICS: (+) for additions, (-) for deductions
    gl_weight_grams NUMERIC(12, 4) NOT NULL,       
    gl_total_amount_inr NUMERIC(14, 2) NOT NULL,   
    
    -- The Immutable Running Balance
    gl_running_gold_balance_grams NUMERIC(12, 4) NOT NULL,
    
    -- Full Pricing Breakdown Snapshot (For GOLD_PURCHASE)
    gl_mcx_base_rate NUMERIC(12, 2) DEFAULT 0.00,
    gl_master_margin_applied NUMERIC(12, 2) DEFAULT 0.00,
    gl_tenant_margin_applied NUMERIC(12, 2) DEFAULT 0.00,
    gl_gst_applied NUMERIC(12, 2) DEFAULT 0.00,
    gl_final_rate_per_gram NUMERIC(12, 2) DEFAULT 0.00,
    
    gl_reference_id VARCHAR(100), 
    gl_metadata JSONB DEFAULT '{}', 
    
    gl_created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_ledger_external_id ON gold_transaction_ledger(gl_external_id);
CREATE INDEX idx_ledger_tenant_date ON gold_transaction_ledger(gl_tenant_id, gl_created_at DESC);
CREATE INDEX idx_ledger_user_passbook ON gold_transaction_ledger(gl_user_id, gl_created_at DESC);

-- 1. Singleton State Table: Tracks the live accumulated unhedged exposure
CREATE TABLE master_hedging_state (
    mhs_id INT PRIMARY KEY DEFAULT 1,
    mhs_unhedged_grams NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
    mhs_total_hedged_grams NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    mhs_last_hedged_at TIMESTAMPTZ,
    mhs_updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT single_row_constraint CHECK (mhs_id = 1)
);

-- Initialize the single state row on boot
INSERT INTO master_hedging_state (mhs_id, mhs_unhedged_grams, mhs_total_hedged_grams) 
VALUES (1, 0.0000, 0.0000) 
ON CONFLICT DO NOTHING;

-- 2. Audit Ledger for all Liquidity Provider orders
CREATE TYPE hedge_order_status_enum AS ENUM ('PENDING', 'FILLED', 'FAILED', 'REJECTED');

CREATE TABLE master_hedging_orders (
    mho_id BIGSERIAL PRIMARY KEY,
    mho_external_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    
    mho_lot_weight_grams NUMERIC(12, 4) NOT NULL, -- Always multiples of 10.0000
    mho_lp_execution_rate NUMERIC(12, 2),          -- Rate confirmed by LP
    mho_lp_total_amount_inr NUMERIC(14, 2),        -- Total invoice from LP
    
    mho_status hedge_order_status_enum NOT NULL DEFAULT 'PENDING',
    mho_lp_order_reference VARCHAR(100),           -- LP's tracking/trade ID
    mho_error_log TEXT,                            -- If API times out or fails
    
    mho_created_at TIMESTAMPTZ DEFAULT NOW(),
    mho_completed_at TIMESTAMPTZ
);

CREATE INDEX idx_hedging_orders_status ON master_hedging_orders(mho_status, mho_created_at DESC);
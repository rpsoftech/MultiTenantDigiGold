-- DigiGold mock data for local development and staging. NOT for production.
--
-- Load it with `go run ./cmd/dbtool seed` (which also sets the starting gold rate in Redis
-- and refuses to run when APP_ENV=PRODUCTION), or with psql in one transaction:
--   psql -1 -f internal/database/mock_data.sql
-- Every row has a fixed UUID and is inserted with ON CONFLICT DO NOTHING, so loading it
-- twice changes nothing. Dates are relative to NOW(), so "today" lists always have rows.
--
-- Every admin signs in with password DigiGold@123 and the TOTP secret
-- JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP (add it to any authenticator app). The stores' Razorpay
-- keys are placeholders: set real test keys with the SEED_RAZORPAY_* variables (see dbtool).
--
-- Every store has the DigiGold default UI config and its outbound webhook off. OTPs go
-- through the platform's WhatsApp config, whose endpoint is a placeholder, so no message is
-- sent: read the code from Redis (<REDIS_DEFAULT_KEY>tenant:<tenant uuid>:otp_session:<phone>).
--
-- Balances follow the ledger: each customer's vault balance is the sum of their ledger
-- entries, and each store's unlifted grams the sum of its customers' entries. Keep it so
-- when you edit this file (the integration test TestMockDataIsConsistent checks it).
--
-- No system_events rows: the outbox would publish them again and the hedging consumer
-- would count the trades twice. The audit log starts empty.

-- Stores. "default" is the platform tenant: platform admins sign in through it, and its
-- config is the fallback (e.g. WhatsApp) for every store. "closed" is suspended.
-- ui_json_config is what the frontend themes the store with (brand logo, colors, fonts,
-- modules shown); every store has the DigiGold defaults.
INSERT INTO tenants (tenant_uuid, tenant_full_name, tenant_short_name, tenant_subdomain, tenant_is_active, tenant_ui_json_config) VALUES
    ('01900000-0000-7000-8000-000000000001', 'DigiGold Platform', 'default', 'platform', TRUE,
     '{"brandLogo": {"url": "/brand/logo.svg", "alt": "DigiGold"}, "theme": {"colors": {"primary": "#D4AF37", "secondary": "#1A1A1A", "tertiary": "#C5A028", "neutral": "#F8F9FA"}, "fontFamily": {"headline": "Hanken Grotesk", "body": "Hanken Grotesk", "label": "Hanken Grotesk"}}, "activeModules": {"home": true, "trading": true, "vault": true, "ecommerce": true}}'),
    ('01900000-0000-7000-8000-000000000002', 'Demo Jewellers', 'demo', 'demo', TRUE,
     '{"brandLogo": {"url": "/brand/logo.svg", "alt": "DigiGold"}, "theme": {"colors": {"primary": "#D4AF37", "secondary": "#1A1A1A", "tertiary": "#C5A028", "neutral": "#F8F9FA"}, "fontFamily": {"headline": "Hanken Grotesk", "body": "Hanken Grotesk", "label": "Hanken Grotesk"}}, "activeModules": {"home": true, "trading": true, "vault": true, "ecommerce": true}}'),
    ('01900000-0000-7000-8000-000000000003', 'Other Jewellers', 'other', 'other', TRUE,
     '{"brandLogo": {"url": "/brand/logo.svg", "alt": "DigiGold"}, "theme": {"colors": {"primary": "#D4AF37", "secondary": "#1A1A1A", "tertiary": "#C5A028", "neutral": "#F8F9FA"}, "fontFamily": {"headline": "Hanken Grotesk", "body": "Hanken Grotesk", "label": "Hanken Grotesk"}}, "activeModules": {"home": true, "trading": true, "vault": true, "ecommerce": true}}'),
    ('01900000-0000-7000-8000-000000000004', 'Closed Jewellers', 'closed', 'closed', FALSE,
     '{"brandLogo": {"url": "/brand/logo.svg", "alt": "DigiGold"}, "theme": {"colors": {"primary": "#D4AF37", "secondary": "#1A1A1A", "tertiary": "#C5A028", "neutral": "#F8F9FA"}, "fontFamily": {"headline": "Hanken Grotesk", "body": "Hanken Grotesk", "label": "Hanken Grotesk"}}, "activeModules": {"home": true, "trading": true, "vault": true, "ecommerce": true}}')
ON CONFLICT DO NOTHING;

-- Internal configs. WhatsApp: the stores send OTPs through the platform (DEFAULT), whose
-- endpoint is a placeholder that never resolves, so in development the OTP is read from
-- Redis. Payment: placeholder Razorpay keys (SEED_RAZORPAY_* sets real test keys).
-- Other: the outbound webhook is off.
INSERT INTO tenant_internal_configs (tic_uuid, tic_tenant_id, tic_whatsapp_json, tic_payment_gateway_json, tic_other_json) VALUES
    ('01900000-0000-7000-8000-000000000301', (SELECT tenant_id FROM tenants WHERE tenant_uuid = '01900000-0000-7000-8000-000000000001'),
     '{"provider_type": "UNOFFICIAL", "unofficial_config": {"api_endpoint": "https://whatsapp.invalid/send", "auth_token": "placeholder_whatsapp_token"}, "template_mappings": {"OTP_REQUEST": {"name": "otp_request", "body": "Hello {{name}}, your {{tenant_name}} code is {{otp_code}}. It expires in 10 minutes.", "language": "en"}}}',
     '{}', '{"webhooks": {"is_enabled": false}}'),
    ('01900000-0000-7000-8000-000000000302', (SELECT tenant_id FROM tenants WHERE tenant_uuid = '01900000-0000-7000-8000-000000000002'),
     '{"provider_type": "DEFAULT", "template_mappings": {"OTP_REQUEST": {"name": "otp_request", "body": "Hello {{name}}, your {{tenant_name}} code is {{otp_code}}. It expires in 10 minutes.", "language": "en"}}}',
     '{"provider_type": "CUSTOM", "key_id": "rzp_test_placeholder", "key_secret": "placeholder_key_secret", "webhook_secret": "placeholder_webhook_secret"}',
     '{"webhooks": {"is_enabled": false}}'),
    ('01900000-0000-7000-8000-000000000303', (SELECT tenant_id FROM tenants WHERE tenant_uuid = '01900000-0000-7000-8000-000000000003'),
     '{"provider_type": "DEFAULT", "template_mappings": {"OTP_REQUEST": {"name": "otp_request", "body": "Hello {{name}}, your {{tenant_name}} code is {{otp_code}}. It expires in 10 minutes.", "language": "en"}}}',
     '{"provider_type": "CUSTOM", "key_id": "rzp_test_placeholder", "key_secret": "placeholder_key_secret", "webhook_secret": "placeholder_webhook_secret"}',
     '{"webhooks": {"is_enabled": false}}'),
    ('01900000-0000-7000-8000-000000000304', (SELECT tenant_id FROM tenants WHERE tenant_uuid = '01900000-0000-7000-8000-000000000004'),
     '{"provider_type": "DEFAULT", "template_mappings": {"OTP_REQUEST": {"name": "otp_request", "body": "Hello {{name}}, your {{tenant_name}} code is {{otp_code}}. It expires in 10 minutes.", "language": "en"}}}',
     '{"provider_type": "CUSTOM", "key_id": "rzp_test_placeholder", "key_secret": "placeholder_key_secret", "webhook_secret": "placeholder_webhook_secret"}',
     '{"webhooks": {"is_enabled": false}}')
ON CONFLICT DO NOTHING;

-- Selling price = (MCX ask + ₹100/g margin) + 3% GST; 1000 g store credit limit.
INSERT INTO margin_configurations (
    mc_tenant_id, mc_commodity_type, mc_sell_margin_type, mc_sell_margin_value,
    mc_is_gst_enabled, mc_gst_percentage, mc_tenant_credit_limit_grams, mc_tenant_unlifted_grams
) VALUES
    ((SELECT tenant_id FROM tenants WHERE tenant_uuid = '01900000-0000-7000-8000-000000000002'), 'GOLD', 'FIXED_INR', 100.0000, TRUE, 3.00, 1000.0000, 4.5000),
    ((SELECT tenant_id FROM tenants WHERE tenant_uuid = '01900000-0000-7000-8000-000000000003'), 'GOLD', 'FIXED_INR', 100.0000, TRUE, 3.00, 1000.0000, 1.0000),
    ((SELECT tenant_id FROM tenants WHERE tenant_uuid = '01900000-0000-7000-8000-000000000004'), 'GOLD', 'FIXED_INR', 100.0000, TRUE, 3.00, 1000.0000, 0.0000)
ON CONFLICT DO NOTHING;

-- Admins (password DigiGold@123, TOTP secret above).
INSERT INTO tenant_user_logins (
    tu_uuid, tu_tenant_id, tu_username, tu_phone_number, tu_password_hash,
    tu_totp_secret, tu_is_totp_enabled, tu_role, tu_is_active
) VALUES
    -- platform admin
    ('01900000-0000-7000-8000-000000000101', (SELECT tenant_id FROM tenants WHERE tenant_uuid = '01900000-0000-7000-8000-000000000001'), 'platform-admin', '9000000001', '$2a$10$HOV6jyksmip4c4K7yrhAYe2Alqtl6yd7uPdu1emp2A5Iaig1NGRpC',
     'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP', TRUE, 'super_admin', TRUE),
    -- demo store manager
    ('01900000-0000-7000-8000-000000000102', (SELECT tenant_id FROM tenants WHERE tenant_uuid = '01900000-0000-7000-8000-000000000002'), 'demo-manager', '9000000002', '$2a$10$HOV6jyksmip4c4K7yrhAYe2Alqtl6yd7uPdu1emp2A5Iaig1NGRpC',
     'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP', TRUE, 'manager', TRUE),
    -- other store manager
    ('01900000-0000-7000-8000-000000000103', (SELECT tenant_id FROM tenants WHERE tenant_uuid = '01900000-0000-7000-8000-000000000003'), 'other-manager', '9000000003', '$2a$10$HOV6jyksmip4c4K7yrhAYe2Alqtl6yd7uPdu1emp2A5Iaig1NGRpC',
     'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP', TRUE, 'manager', TRUE),
    -- has not set up TOTP yet: first sign-in enrols it
    ('01900000-0000-7000-8000-000000000104', (SELECT tenant_id FROM tenants WHERE tenant_uuid = '01900000-0000-7000-8000-000000000002'), 'demo-new-staff', '9000000004', '$2a$10$HOV6jyksmip4c4K7yrhAYe2Alqtl6yd7uPdu1emp2A5Iaig1NGRpC',
     NULL, FALSE, 'manager', TRUE),
    -- deactivated: sign-in is refused
    ('01900000-0000-7000-8000-000000000105', (SELECT tenant_id FROM tenants WHERE tenant_uuid = '01900000-0000-7000-8000-000000000002'), 'demo-former-staff', '9000000005', '$2a$10$HOV6jyksmip4c4K7yrhAYe2Alqtl6yd7uPdu1emp2A5Iaig1NGRpC',
     'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP', TRUE, 'manager', FALSE),
    -- manager of the suspended store
    ('01900000-0000-7000-8000-000000000106', (SELECT tenant_id FROM tenants WHERE tenant_uuid = '01900000-0000-7000-8000-000000000004'), 'closed-manager', '9000000006', '$2a$10$HOV6jyksmip4c4K7yrhAYe2Alqtl6yd7uPdu1emp2A5Iaig1NGRpC',
     'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP', TRUE, 'manager', TRUE)
ON CONFLICT DO NOTHING;

-- Store KYC documents, decided by the platform admin: verified, waiting for review, rejected.
INSERT INTO tenant_kyc_documents (
    tkd_uuid, tkd_tenant_id, tkd_document_type, tkd_document_url, tkd_document_number,
    tkd_status, tkd_verified_by, tkd_verified_at, tkd_created_at, tkd_modified_at
) VALUES
    ('01900000-0000-7000-8000-000000000801', (SELECT tenant_id FROM tenants WHERE tenant_uuid = '01900000-0000-7000-8000-000000000002'), 'PAN', 'https://files.example.com/kyc/demo/pan.pdf', 'AAACD1234E',
     'VERIFIED', (SELECT tu_id FROM tenant_user_logins WHERE tu_uuid = '01900000-0000-7000-8000-000000000101'), NOW() - INTERVAL '39 days', NOW() - INTERVAL '40 days', NOW() - INTERVAL '39 days'),
    ('01900000-0000-7000-8000-000000000802', (SELECT tenant_id FROM tenants WHERE tenant_uuid = '01900000-0000-7000-8000-000000000002'), 'GST_CERTIFICATE', 'https://files.example.com/kyc/demo/gst.pdf', '24AAACD1234E1Z5',
     'VERIFIED', (SELECT tu_id FROM tenant_user_logins WHERE tu_uuid = '01900000-0000-7000-8000-000000000101'), NOW() - INTERVAL '38 days', NOW() - INTERVAL '40 days', NOW() - INTERVAL '38 days'),
    ('01900000-0000-7000-8000-000000000803', (SELECT tenant_id FROM tenants WHERE tenant_uuid = '01900000-0000-7000-8000-000000000003'), 'BUSINESS_REGISTRATION', 'https://files.example.com/kyc/other/registration.pdf', 'U36911GJ2020PTC000001',
     'PENDING', NULL, NULL, NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
    ('01900000-0000-7000-8000-000000000804', (SELECT tenant_id FROM tenants WHERE tenant_uuid = '01900000-0000-7000-8000-000000000004'), 'DIRECTOR_ID', 'https://files.example.com/kyc/closed/director-id.pdf', '01234567',
     'REJECTED', (SELECT tu_id FROM tenant_user_logins WHERE tu_uuid = '01900000-0000-7000-8000-000000000101'), NOW() - INTERVAL '10 days', NOW() - INTERVAL '12 days', NOW() - INTERVAL '10 days')
ON CONFLICT DO NOTHING;

-- Customers. KYC: verified, pending review (in the queue), not started, rejected.
INSERT INTO users (
    user_uuid, user_tenant_id, user_full_name, user_phone_number, user_city,
    user_kyc_status, user_document_json, user_kyc_submitted_at, user_kyc_decided_at,
    user_status_approved_by, user_total_vault_balance
) VALUES
    ('01900000-0000-7000-8000-000000000201', (SELECT tenant_id FROM tenants WHERE tenant_uuid = '01900000-0000-7000-8000-000000000002'), 'Verified Customer', '9999900001', 'Mumbai',
     'verified', '{"pan_number": "ABCDE1234F", "aadhaar_last4": "1234"}', NOW() - INTERVAL '32 days', NOW() - INTERVAL '31 days',
     (SELECT tu_id FROM tenant_user_logins WHERE tu_uuid = '01900000-0000-7000-8000-000000000102'), 1.5000),
    ('01900000-0000-7000-8000-000000000202', (SELECT tenant_id FROM tenants WHERE tenant_uuid = '01900000-0000-7000-8000-000000000002'), 'Pending Customer', '9999900002', 'Pune',
     'pending', '{"pan_number": "PQRSX5678K", "aadhaar_last4": "5678"}', NOW() - INTERVAL '2 days', NULL,
     NULL, 2.0000),
    ('01900000-0000-7000-8000-000000000203', (SELECT tenant_id FROM tenants WHERE tenant_uuid = '01900000-0000-7000-8000-000000000002'), 'Rohan Mehta', '9999900003', 'Ahmedabad',
     'pending', '{}', NULL, NULL,
     NULL, 0.0000),
    ('01900000-0000-7000-8000-000000000204', (SELECT tenant_id FROM tenants WHERE tenant_uuid = '01900000-0000-7000-8000-000000000002'), 'Priya Shah', '9999900004', 'Surat',
     'rejected', '{"pan_number": "LMNOP4321Z", "aadhaar_last4": "4321"}', NOW() - INTERVAL '8 days', NOW() - INTERVAL '6 days',
     (SELECT tu_id FROM tenant_user_logins WHERE tu_uuid = '01900000-0000-7000-8000-000000000102'), 1.0000),
    ('01900000-0000-7000-8000-000000000211', (SELECT tenant_id FROM tenants WHERE tenant_uuid = '01900000-0000-7000-8000-000000000003'), 'Other Customer', '9999900011', 'Delhi',
     'verified', '{"pan_number": "FGHIJ8765L", "aadhaar_last4": "8765"}', NOW() - INTERVAL '20 days', NOW() - INTERVAL '19 days',
     (SELECT tu_id FROM tenant_user_logins WHERE tu_uuid = '01900000-0000-7000-8000-000000000103'), 1.0000)
ON CONFLICT DO NOTHING;

-- The gold ledger. Weights are signed: + into the vault, - out of it. A reversal points at
-- the entry it reverses (REVERSAL_<gl_uuid>); a counter sale's reference is COUNTER_<quote>.
INSERT INTO gold_transaction_ledger (
    gl_uuid, gl_tenant_id, gl_user_id, gl_event_type, gl_payment_mode,
    gl_weight_grams, gl_total_amount_inr, gl_running_gold_balance_grams,
    gl_mcx_base_rate, gl_master_margin_applied, gl_tenant_margin_applied, gl_gst_applied,
    gl_final_rate_per_gram, gl_reference_id, gl_created_at
) VALUES
    -- Verified Customer
    ('01900000-0000-7000-8000-000000000501', (SELECT tenant_id FROM tenants WHERE tenant_uuid = '01900000-0000-7000-8000-000000000002'), (SELECT user_id FROM users WHERE user_uuid = '01900000-0000-7000-8000-000000000201'), 'GOLD_PURCHASE', 'ONLINE_PG',
     2.0000, 14420.00, 2.0000,
     6900.00, 0.00, 100.00, 210.00,
     7210.00, 'pay_mock_000000000001', NOW() - INTERVAL '30 days'),
    ('01900000-0000-7000-8000-000000000502', (SELECT tenant_id FROM tenants WHERE tenant_uuid = '01900000-0000-7000-8000-000000000002'), (SELECT user_id FROM users WHERE user_uuid = '01900000-0000-7000-8000-000000000201'), 'GOLD_PURCHASE', 'COUNTER_CASH',
     1.5000, 10892.25, 3.5000,
     6950.00, 0.00, 100.00, 211.50,
     7261.50, 'COUNTER_01900000-0000-7000-8000-000000000701', NOW() - INTERVAL '22 days'),
    ('01900000-0000-7000-8000-000000000503', (SELECT tenant_id FROM tenants WHERE tenant_uuid = '01900000-0000-7000-8000-000000000002'), (SELECT user_id FROM users WHERE user_uuid = '01900000-0000-7000-8000-000000000201'), 'GOLD_PURCHASE', 'ONLINE_PG',
     0.5000, 3656.50, 4.0000,
     7000.00, 0.00, 100.00, 213.00,
     7313.00, 'pay_mock_000000000002', NOW() - INTERVAL '15 days'),
    ('01900000-0000-7000-8000-000000000504', (SELECT tenant_id FROM tenants WHERE tenant_uuid = '01900000-0000-7000-8000-000000000002'), (SELECT user_id FROM users WHERE user_uuid = '01900000-0000-7000-8000-000000000201'), 'SYSTEM_REVERSAL', 'NONE',
     -0.5000, -3656.50, 3.5000,
     7000.00, 0.00, -100.00, -213.00,
     7313.00, 'REVERSAL_01900000-0000-7000-8000-000000000503', NOW() - INTERVAL '14 days'),
    ('01900000-0000-7000-8000-000000000505', (SELECT tenant_id FROM tenants WHERE tenant_uuid = '01900000-0000-7000-8000-000000000002'), (SELECT user_id FROM users WHERE user_uuid = '01900000-0000-7000-8000-000000000201'), 'PHYSICAL_REDEMPTION', 'NONE',
     -1.0000, 0.00, 2.5000,
     6950.00, 0.00, 0.00, 0.00,
     6950.00, '', NOW() - INTERVAL '10 days'),
    ('01900000-0000-7000-8000-000000000506', (SELECT tenant_id FROM tenants WHERE tenant_uuid = '01900000-0000-7000-8000-000000000002'), (SELECT user_id FROM users WHERE user_uuid = '01900000-0000-7000-8000-000000000201'), 'PHYSICAL_REDEMPTION', 'NONE',
     -1.0000, 0.00, 1.5000,
     6980.00, 0.00, 0.00, 0.00,
     6980.00, '', NOW() - INTERVAL '1 day'),
    -- Pending Customer
    ('01900000-0000-7000-8000-000000000511', (SELECT tenant_id FROM tenants WHERE tenant_uuid = '01900000-0000-7000-8000-000000000002'), (SELECT user_id FROM users WHERE user_uuid = '01900000-0000-7000-8000-000000000202'), 'GOLD_PURCHASE', 'ONLINE_PG',
     3.0000, 22093.50, 3.0000,
     7050.00, 0.00, 100.00, 214.50,
     7364.50, 'pay_mock_000000000003', NOW() - INTERVAL '5 days'),
    ('01900000-0000-7000-8000-000000000512', (SELECT tenant_id FROM tenants WHERE tenant_uuid = '01900000-0000-7000-8000-000000000002'), (SELECT user_id FROM users WHERE user_uuid = '01900000-0000-7000-8000-000000000202'), 'PHYSICAL_REDEMPTION', 'NONE',
     -1.0000, 0.00, 2.0000,
     7000.00, 0.00, 0.00, 0.00,
     7000.00, '', NOW() - INTERVAL '3 days'),
    ('01900000-0000-7000-8000-000000000513', (SELECT tenant_id FROM tenants WHERE tenant_uuid = '01900000-0000-7000-8000-000000000002'), (SELECT user_id FROM users WHERE user_uuid = '01900000-0000-7000-8000-000000000202'), 'SYSTEM_REVERSAL', 'NONE',
     1.0000, 0.00, 3.0000,
     7000.00, 0.00, 0.00, 0.00,
     7000.00, 'REVERSAL_01900000-0000-7000-8000-000000000512', NOW() - INTERVAL '71 hours'),
    ('01900000-0000-7000-8000-000000000514', (SELECT tenant_id FROM tenants WHERE tenant_uuid = '01900000-0000-7000-8000-000000000002'), (SELECT user_id FROM users WHERE user_uuid = '01900000-0000-7000-8000-000000000202'), 'PHYSICAL_REDEMPTION', 'NONE',
     -1.0000, 0.00, 2.0000,
     6980.00, 0.00, 0.00, 0.00,
     6980.00, '', NOW() - INTERVAL '1 day'),
    -- Priya Shah
    ('01900000-0000-7000-8000-000000000521', (SELECT tenant_id FROM tenants WHERE tenant_uuid = '01900000-0000-7000-8000-000000000002'), (SELECT user_id FROM users WHERE user_uuid = '01900000-0000-7000-8000-000000000204'), 'GOLD_PURCHASE', 'COUNTER_UPI',
     2.0000, 14626.00, 2.0000,
     7000.00, 0.00, 100.00, 213.00,
     7313.00, 'COUNTER_01900000-0000-7000-8000-000000000702', NOW() - INTERVAL '7 days'),
    ('01900000-0000-7000-8000-000000000522', (SELECT tenant_id FROM tenants WHERE tenant_uuid = '01900000-0000-7000-8000-000000000002'), (SELECT user_id FROM users WHERE user_uuid = '01900000-0000-7000-8000-000000000204'), 'PHYSICAL_REDEMPTION', 'NONE',
     -1.0000, 0.00, 1.0000,
     7000.00, 0.00, 0.00, 0.00,
     7000.00, '', NOW() - INTERVAL '4 days'),
    -- Other Customer
    ('01900000-0000-7000-8000-000000000531', (SELECT tenant_id FROM tenants WHERE tenant_uuid = '01900000-0000-7000-8000-000000000003'), (SELECT user_id FROM users WHERE user_uuid = '01900000-0000-7000-8000-000000000211'), 'GOLD_PURCHASE', 'ONLINE_PG',
     1.0000, 7261.50, 1.0000,
     6950.00, 0.00, 100.00, 211.50,
     7261.50, 'pay_mock_000000000004', NOW() - INTERVAL '12 days')
ON CONFLICT DO NOTHING;

-- Pickups: collected (one today), cancelled (its gold reversed back into the vault),
-- waiting at the counter (code 482913), and locked after 5 wrong codes.
INSERT INTO redemption_requests (
    rr_uuid, rr_tenant_id, rr_user_id, rr_ledger_id, rr_weight_grams, rr_status, rr_pickup_code,
    rr_failed_code_attempts, rr_collected_by, rr_collected_at, rr_cancelled_at, rr_created_at, rr_modified_at
) VALUES
    ('01900000-0000-7000-8000-000000000601', (SELECT tenant_id FROM tenants WHERE tenant_uuid = '01900000-0000-7000-8000-000000000002'), (SELECT user_id FROM users WHERE user_uuid = '01900000-0000-7000-8000-000000000201'),
     (SELECT gl_id FROM gold_transaction_ledger WHERE gl_uuid = '01900000-0000-7000-8000-000000000505'),
     1.0000, 'COLLECTED', '119035', 0, (SELECT tu_id FROM tenant_user_logins WHERE tu_uuid = '01900000-0000-7000-8000-000000000102'), NOW() - INTERVAL '9 days', NULL,
     NOW() - INTERVAL '10 days', NOW() - INTERVAL '9 days'),
    ('01900000-0000-7000-8000-000000000602', (SELECT tenant_id FROM tenants WHERE tenant_uuid = '01900000-0000-7000-8000-000000000002'), (SELECT user_id FROM users WHERE user_uuid = '01900000-0000-7000-8000-000000000201'),
     (SELECT gl_id FROM gold_transaction_ledger WHERE gl_uuid = '01900000-0000-7000-8000-000000000506'),
     1.0000, 'COLLECTED', '284716', 0, (SELECT tu_id FROM tenant_user_logins WHERE tu_uuid = '01900000-0000-7000-8000-000000000102'), NOW() - INTERVAL '2 hours', NULL,
     NOW() - INTERVAL '1 day', NOW() - INTERVAL '2 hours'),
    ('01900000-0000-7000-8000-000000000603', (SELECT tenant_id FROM tenants WHERE tenant_uuid = '01900000-0000-7000-8000-000000000002'), (SELECT user_id FROM users WHERE user_uuid = '01900000-0000-7000-8000-000000000202'),
     (SELECT gl_id FROM gold_transaction_ledger WHERE gl_uuid = '01900000-0000-7000-8000-000000000512'),
     1.0000, 'CANCELLED', '555201', 0, NULL, NULL, NOW() - INTERVAL '71 hours',
     NOW() - INTERVAL '3 days', NOW() - INTERVAL '71 hours'),
    ('01900000-0000-7000-8000-000000000604', (SELECT tenant_id FROM tenants WHERE tenant_uuid = '01900000-0000-7000-8000-000000000002'), (SELECT user_id FROM users WHERE user_uuid = '01900000-0000-7000-8000-000000000202'),
     (SELECT gl_id FROM gold_transaction_ledger WHERE gl_uuid = '01900000-0000-7000-8000-000000000514'),
     1.0000, 'PENDING', '482913', 0, NULL, NULL, NULL,
     NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
    ('01900000-0000-7000-8000-000000000605', (SELECT tenant_id FROM tenants WHERE tenant_uuid = '01900000-0000-7000-8000-000000000002'), (SELECT user_id FROM users WHERE user_uuid = '01900000-0000-7000-8000-000000000204'),
     (SELECT gl_id FROM gold_transaction_ledger WHERE gl_uuid = '01900000-0000-7000-8000-000000000522'),
     1.0000, 'PENDING', '730264', 5, NULL, NULL, NULL,
     NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days')
ON CONFLICT DO NOTHING;

-- The platform holds the net grams of every trade above, none of it hedged yet. Only set
-- on a fresh database, so loading this file again never overwrites real hedging state.
UPDATE master_hedging_state SET mhs_unhedged_grams = 5.5000
WHERE mhs_id = 1 AND mhs_unhedged_grams = 0 AND mhs_total_hedged_grams = 0;

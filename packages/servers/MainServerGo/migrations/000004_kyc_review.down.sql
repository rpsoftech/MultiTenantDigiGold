DROP INDEX IF EXISTS idx_users_kyc_review_queue;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_user_status_approved_by_fkey;
ALTER TABLE users ADD CONSTRAINT users_user_status_approved_by_fkey
    FOREIGN KEY (user_status_approved_by) REFERENCES tenant_user_logins(tu_id) ON DELETE CASCADE;
ALTER TABLE users DROP COLUMN IF EXISTS user_kyc_decided_at;
ALTER TABLE users DROP COLUMN IF EXISTS user_kyc_submitted_at;

-- When the customer last submitted KYC details. The review queue is ordered by it;
-- user_modified_at is not usable for that, since every trade moves it. Submissions made
-- before this column existed are backfilled from user_modified_at, the best record there is.
ALTER TABLE users ADD COLUMN user_kyc_submitted_at TIMESTAMP WITH TIME ZONE;
UPDATE users SET user_kyc_submitted_at = user_modified_at
    WHERE user_document_json IS NOT NULL
      AND user_document_json NOT IN ('{}'::jsonb, 'null'::jsonb);

-- When an admin approved or rejected the KYC; user_status_approved_by records who.
ALTER TABLE users ADD COLUMN user_kyc_decided_at TIMESTAMP WITH TIME ZONE;

-- user_status_approved_by was ON DELETE CASCADE: deleting a staff login would have deleted
-- every customer that staff member reviewed. Keep the customer and forget the reviewer.
DO $$
DECLARE
    fk TEXT;
BEGIN
    FOR fk IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_attribute att
          ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
        WHERE con.conrelid = 'users'::regclass
          AND con.contype = 'f'
          AND att.attname = 'user_status_approved_by'
    LOOP
        EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', fk);
    END LOOP;
END $$;
ALTER TABLE users ADD CONSTRAINT users_user_status_approved_by_fkey
    FOREIGN KEY (user_status_approved_by) REFERENCES tenant_user_logins(tu_id) ON DELETE SET NULL;

-- The review queue: a tenant's pending submissions, oldest first.
CREATE INDEX idx_users_kyc_review_queue ON users(user_tenant_id, user_kyc_submitted_at)
    WHERE user_kyc_status = 'pending';

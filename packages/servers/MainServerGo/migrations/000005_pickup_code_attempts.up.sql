-- Wrong pickup codes entered at the counter for this request. After 5 the request is
-- locked and can only be cancelled (the gold goes back to the vault), so a 6-digit code
-- can't be found by trying them all.
ALTER TABLE redemption_requests ADD COLUMN rr_failed_code_attempts INT NOT NULL DEFAULT 0;

-- The counter's "collected today" list.
CREATE INDEX idx_rr_tenant_collected ON redemption_requests(rr_tenant_id, rr_collected_at DESC)
    WHERE rr_status = 'COLLECTED';

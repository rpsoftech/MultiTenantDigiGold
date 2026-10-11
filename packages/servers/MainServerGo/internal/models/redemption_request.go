package models

import "time"

// Redemption request statuses (rr_status).
const (
	RedemptionPending   = "PENDING"
	RedemptionCollected = "COLLECTED"
	RedemptionCancelled = "CANCELLED"
)

// RedemptionRequest is a customer's request to collect physical gold at the
// store counter. It maps to the redemption_requests table.
type RedemptionRequest struct {
	ID          int64      `json:"-"`
	UUID        string     `json:"redemption_uuid"`
	TenantID    int64      `json:"-"`
	UserID      int64      `json:"-"`
	LedgerID    int64      `json:"-"`
	LedgerUUID  string     `json:"ledger_uuid,omitempty"`
	WeightGrams float64    `json:"weight_grams"`
	Status      string     `json:"status"`
	PickupCode  string     `json:"pickup_code,omitempty"` // shown to the customer only, never to staff
	CollectedAt *time.Time `json:"collected_at,omitempty"`
	CancelledAt *time.Time `json:"cancelled_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`

	// Set on staff listings so the counter can identify the customer.
	CustomerName  string `json:"customer_name,omitempty"`
	CustomerPhone string `json:"customer_phone,omitempty"`

	// Wrong pickup codes entered so far. Internal; listings expose CodeAttemptsLeft.
	FailedCodeAttempts int `json:"-"`
	// Pickup-code tries left before the request locks (0 = locked: it can only be
	// cancelled). Set on the pending and customer listings.
	CodeAttemptsLeft *int `json:"code_attempts_left,omitempty"`
	// Username of the staff member who handed the gold over; on the collected listing.
	CollectedBy string `json:"collected_by,omitempty"`
}

// MaxPickupCodeAttempts is how many wrong pickup codes a request takes before it locks.
const MaxPickupCodeAttempts = 5

// SetCodeAttemptsLeft fills CodeAttemptsLeft from FailedCodeAttempts.
func (rr *RedemptionRequest) SetCodeAttemptsLeft() {
	left := max(MaxPickupCodeAttempts-rr.FailedCodeAttempts, 0)
	rr.CodeAttemptsLeft = &left
}

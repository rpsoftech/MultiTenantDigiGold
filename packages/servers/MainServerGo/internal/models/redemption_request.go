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
}

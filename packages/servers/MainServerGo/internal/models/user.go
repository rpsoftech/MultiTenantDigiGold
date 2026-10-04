package models

import (
	"encoding/json"
	"time"
)

type User struct {
	ID               int64           `json:"-"` // Internal BIGSERIAL
	UUID             string          `json:"user_uuid"`
	TenantID         int64           `json:"-"` // Internal FK
	FullName         *string         `json:"full_name"`
	PhoneNumber      string          `json:"phone_number"`
	EmailID          *string         `json:"email_id"`
	KYCStatus        string          `json:"kyc_status"`
	StatusApprovedBy *int64          `json:"status_approved_by"`
	DocumentJSON     json.RawMessage `json:"document_json"` // JSONB
	ERPUniqueID      *string         `json:"erp_unique_id"`
	VaultBalance     float64         `json:"total_vault_balance"` // DECIMAL(14,4)
	CreatedAt        time.Time       `json:"created_at"`
	ModifiedAt       time.Time       `json:"modified_at"`
}

// Customer-facing KYC states. The DB only stores pending/verified/rejected and defaults
// every new user to 'pending', so "pending" alone can't distinguish "submitted, awaiting
// review" from "never submitted" — the document JSON is what tells them apart.
const (
	KYCStatusNotStarted = "not_started"
	KYCStatusPending    = "pending"
	KYCStatusVerified   = "verified"
	KYCStatusRejected   = "rejected"
)

// KYCDocumentsSubmitted reports whether the customer has sent KYC details. The column
// defaults to '{}', and older rows may hold JSON null.
func (u *User) KYCDocumentsSubmitted() bool {
	var doc map[string]any
	if err := json.Unmarshal(u.DocumentJSON, &doc); err != nil {
		return false
	}
	return len(doc) > 0
}

// CustomerKYCStatus is the status shown to the customer: a 'pending' row with no
// submitted documents is reported as not_started.
func (u *User) CustomerKYCStatus() string {
	if u.KYCStatus == KYCStatusPending && !u.KYCDocumentsSubmitted() {
		return KYCStatusNotStarted
	}
	return u.KYCStatus
}

// CanSubmitKYC is true when a (re)submission is allowed: never submitted, or rejected.
// A verified customer resubmitting would otherwise drop back to pending and lose access
// to KYC-gated purchases; a pending one would overwrite what an admin is reviewing.
func (u *User) CanSubmitKYC() bool {
	status := u.CustomerKYCStatus()
	return status == KYCStatusNotStarted || status == KYCStatusRejected
}

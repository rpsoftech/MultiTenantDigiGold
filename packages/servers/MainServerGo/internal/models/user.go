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

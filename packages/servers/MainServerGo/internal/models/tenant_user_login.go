package models

import (
	"encoding/json"
	"time"
)

type TenantUserLogin struct {
	ID              int64           `json:"-"` // Internal BIGSERIAL
	UUID            string          `json:"admin_uuid"`
	TenantID        int64           `json:"-"` // Internal FK
	Username        string          `json:"username"`
	PhoneNumber     string          `json:"phone_number"`
	PasswordHash    string          `json:"-"` // Never expose to JSON
	TOTPSecret      string          `json:"-"`
	IsTOTPEnabled   bool            `json:"is_totp_enabled"`
	Role            string          `json:"role"`
	IsActive        bool            `json:"is_active"`
	PermissionsJSON json.RawMessage `json:"permissions_json"` // JSONB
	CreatedAt       time.Time       `json:"created_at"`
	ModifiedAt      time.Time       `json:"modified_at"`
}

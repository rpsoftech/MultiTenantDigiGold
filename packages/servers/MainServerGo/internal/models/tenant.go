package models

import (
	"encoding/json"
	"time"
)

type Tenant struct {
	ID int64 `json:"-"` // Internal BIGSERIAL
	// ExportID carries ID through the Redis cache only (ID itself is never serialised). It is
	// zero on every Tenant the repository returns, so the internal ID never reaches a response.
	ExportID         int64           `json:"id,omitempty"`
	UUID             string          `json:"tenant_uuid"`
	FullName         string          `json:"full_name"`
	ShortName        *string         `json:"short_name"`
	Domain           *string         `json:"domain"`
	Subdomain        *string         `json:"subdomain"`
	DomainExpiry     *time.Time      `json:"domain_expiry"`
	PlanExpiry       *time.Time      `json:"plan_expiry"`
	RenewalCost      float64         `json:"renewal_cost"`
	KYCMode          string          `json:"kyc_mode"`
	MarkupPercentage float64         `json:"markup_percentage"`
	UIJSONConfig     json.RawMessage `json:"ui_json_config"` // JSONB
	// IsActive is false while the store is suspended: its customers and staff are refused.
	IsActive   bool      `json:"is_active"`
	CreatedAt  time.Time `json:"created_at"`
	ModifiedAt time.Time `json:"modified_at"`
}

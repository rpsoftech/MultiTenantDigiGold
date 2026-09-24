package models

import "time"

type TenantKYCDocument struct {
	ID           int64     `json:"-"`
	UUID         string    `json:"tkd_uuid"`
	TenantID     int64     `json:"tkd_tenant_id"`
	DocumentType string    `json:"tkd_document_type"`
	DocumentURL  string    `json:"tkd_document_url"`
	Status       string    `json:"tkd_status"`
	VerifiedBy   string    `json:"tkd_verified_by"`
	CreatedAt    time.Time `json:"tkd_created_at"`
	ModifiedAt   time.Time `json:"tkd_modified_at"`
}

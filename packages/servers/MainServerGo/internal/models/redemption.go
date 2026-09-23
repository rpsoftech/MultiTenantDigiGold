package models

import (
	"encoding/json"
	"time"
)

type RedemptionFulfillment struct {
	ID                 int64           `json:"-"`
	UUID               string          `json:"rf_uuid"`
	LedgerID           int64           `json:"-"`
	TenantID           int64           `json:"-"`
	UserID             int64           `json:"-"`
	ItemSKU            string          `json:"item_sku"`
	FulfillmentStatus  string          `json:"fulfillment_status"` // PENDING, DISPATCHED, DELIVERED, CANCELLED
	CourierName        *string         `json:"courier_name,omitempty"`
	TrackingNumber     *string         `json:"tracking_number,omitempty"`
	ShippingDetailJSON json.RawMessage `json:"shipping_detail_json,omitempty"`
	IsExported         bool            `json:"is_exported"`
	ExportedAt         *time.Time      `json:"exported_at,omitempty"`
	CreatedAt          time.Time       `json:"created_at"`
	ModifiedAt         time.Time       `json:"modified_at"`
}

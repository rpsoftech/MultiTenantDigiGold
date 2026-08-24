package models

import "time"

// MarginConfig represents the margin_configurations table
type MarginConfig struct {
	ID              int64     `json:"-"`
	UUID            string    `json:"uuid"`
	TenantID        int64     `json:"-"`
	CommodityType   string    `json:"commodity_type"`
	SellMarginType  string    `json:"sell_margin_type"` // e.g., "PERCENTAGE", "FLAT"
	SellMarginValue float64   `json:"sell_margin_value"`
	IsGSTEnabled    bool      `json:"is_gst_enabled"`
	GSTPercentage   float64   `json:"gst_percentage"`
	IsActive        bool      `json:"is_active"`
	CreatedAt       time.Time `json:"created_at"`
	ModifiedAt      time.Time `json:"modified_at"`
}

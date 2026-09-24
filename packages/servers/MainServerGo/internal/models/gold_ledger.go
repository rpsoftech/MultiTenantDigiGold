package models

import (
	"encoding/json"
	"time"
)

type GoldTransactionLedger struct {
	ID                      int64           `json:"-"`
	UUID                    string          `json:"gl_uuid"`
	TenantID                int64           `json:"-"`
	UserID                  int64           `json:"-"`
	EventType               string          `json:"event_type"`   // GOLD_PURCHASE, PHYSICAL_REDEMPTION, SYSTEM_REVERSAL, ADMIN_ADJUSTMENT
	PaymentMode             string          `json:"payment_mode"` // ONLINE_PG, COUNTER_CASH, COUNTER_UPI, NONE
	WeightGrams             float64         `json:"weight_grams"` // Signed: (+) for buy, (-) for redeem
	TotalAmountINR          float64         `json:"total_amount_inr"`
	RunningGoldBalanceGrams float64         `json:"running_gold_balance_grams"`
	MCXBaseRate             float64         `json:"mcx_base_rate"`
	MasterMarginApplied     float64         `json:"master_margin_applied"`
	TenantMarginApplied     float64         `json:"tenant_margin_applied"`
	GSTApplied              float64         `json:"gst_applied"`
	FinalRatePerGram        float64         `json:"final_rate_per_gram"`
	ReferenceID             string          `json:"reference_id,omitempty"`
	MetadataJSON            json.RawMessage `json:"metadata_json,omitempty"`
	CreatedAt               time.Time       `json:"created_at"`
	ModifiedAt              time.Time       `json:"modified_at"`
}

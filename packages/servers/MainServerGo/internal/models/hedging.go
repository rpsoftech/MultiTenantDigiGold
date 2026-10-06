package models

import "time"

type MasterHedgingState struct {
	ID               int        `json:"-"`
	UnhedgedGrams    float64    `json:"unhedged_grams"`
	TotalHedgedGrams float64    `json:"total_hedged_grams"`
	LastHedgedAt     *time.Time `json:"last_hedged_at,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	ModifiedAt       time.Time  `json:"modified_at"`
}

type MasterHedgingOrder struct {
	ID               int64      `json:"-"`
	UUID             string     `json:"mho_uuid"`
	LotWeightGrams   float64    `json:"lot_weight_grams"`
	LPExecutionRate  *float64   `json:"lp_execution_rate,omitempty"`
	LPTotalAmountINR *float64   `json:"lp_total_amount_inr,omitempty"`
	Status           string     `json:"status"` // PENDING, FILLED, FAILED, REJECTED
	LPOrderReference *string    `json:"lp_order_reference,omitempty"`
	ErrorLog         *string    `json:"error_log,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	CompletedAt      *time.Time `json:"completed_at,omitempty"`
	ModifiedAt       time.Time  `json:"modified_at"`
}

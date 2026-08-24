package interfaces

type TradeExecutionRequest struct {
	TenantID             int64   `json:"tenant_id"`
	UserID               int64   `json:"user_id"`
	RequestedRatePerGram float64 `json:"requested_rate_per_gram"`
	WeightGrams          float64 `json:"weight_grams"`
	TotalAmountINR       float64 `json:"total_amount_inr"`
	PaymentMode          string  `json:"payment_mode"` // ONLINE_PG, COUNTER_CASH, COUNTER_UPI
	ReferenceID          string  `json:"reference_id"`
}

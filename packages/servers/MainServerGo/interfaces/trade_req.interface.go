package interfaces

// TradeExecutionRequest is a gold buy. Customers can only buy gold; they take
// gold out only as physical gold collected at the store counter (see RedemptionRequest).
type TradeExecutionRequest struct {
	TenantID             int64   `json:"tenant_id"`
	UserID               int64   `json:"user_id"`
	RequestedRatePerGram float64 `json:"requested_rate_per_gram"`
	WeightGrams          float64 `json:"weight_grams"`
	TotalAmountINR       float64 `json:"total_amount_inr"`
	PaymentMode          string  `json:"payment_mode"` // ONLINE_PG, COUNTER_CASH, COUNTER_UPI
	ReferenceID          string  `json:"reference_id"`
}

// RedemptionRequestInput is a customer's request to collect physical gold at the counter.
type RedemptionRequestInput struct {
	WeightGrams float64 `json:"weight_grams"`
}

// NOTE: candidate for @digigold/core — mirrors MainServer's trade DTOs (see
// MainServerGo/internal/api/trade/customer_trade_controller.go InitiateBuy/History and
// MainServerGo/internal/interfaces/trade_req.interface.go TradeExecutionRequest).

export type InitiateBuyPayload = {
  total_amount_inr: number;
  requested_rate_per_gram: number;
};

export type InitiateBuyResult = {
  success: boolean;
  order_id: string;
  amount: number;
  weight_grams: number;
  final_rate_per_gram: number;
  quote_expires_at: string;
};

// Subset of MainServerGo's models.GoldTransactionLedger — only the fields the buy flow
// needs to detect settlement of a specific payment.
export type TradeHistoryEntry = {
  gl_uuid: string;
  event_type: string;
  weight_grams: number;
  total_amount_inr: number;
  final_rate_per_gram: number;
  reference_id?: string;
  created_at: string;
};

export type TradeHistoryResult = {
  success: boolean;
  data: TradeHistoryEntry[];
  page: number;
  limit: number;
};

export type TradeHistoryParams = {
  page?: number;
  limit?: number;
};

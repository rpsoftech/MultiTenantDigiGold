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
  quote_expires_at: number; // unix seconds (TradeQuote.ExpiresAt), not an ISO string
};

// Ledger event types a customer's history can contain (see MainServerGo's
// ledgerEventPurchase/ledgerEventRedemption/ledgerEventReversal constants in
// internal/service/trade_service.go; ADMIN_ADJUSTMENT is written by admin tooling).
export type TradeEventType =
  | 'GOLD_PURCHASE'
  | 'PHYSICAL_REDEMPTION'
  | 'SYSTEM_REVERSAL'
  | 'ADMIN_ADJUSTMENT';

// Mirrors MainServerGo's models.GoldTransactionLedger (see gold_ledger.go) — the fields
// the buy flow needs to detect settlement, plus the passbook display fields.
export type TradeHistoryEntry = {
  gl_uuid: string;
  event_type: TradeEventType;
  payment_mode: string;
  weight_grams: number;
  total_amount_inr: number;
  running_gold_balance_grams: number;
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

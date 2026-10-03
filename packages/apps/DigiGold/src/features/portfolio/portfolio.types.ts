// NOTE: candidate for @digigold/core, mirrors GET /user/portfolio (see
// MainServerGo/internal/api/trade/customer_trade_controller.go Portfolio).
export type PortfolioResult = {
  success: boolean;
  balance_grams: number;
  current_valuation_inr: number;
  live_rate: Record<string, number> | null;
};

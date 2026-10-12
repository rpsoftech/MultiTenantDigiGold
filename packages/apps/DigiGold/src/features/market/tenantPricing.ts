// MainServer's rate feed (GET /rates/last-rate, GET /rates/stream) only ever returns the
// raw MCX {bid, ask} rate — there is no public endpoint exposing a tenant's margin/GST
// config (it's admin-only, stored in the margin_configs table and applied server-side only
// inside PriceTrade -> buyPrice(), see MainServerGo/internal/service/trade_service.go).
//
// This mirrors that formula client-side using the platform DEFAULT margin config (see
// MainServerGo/migrations/000001_init.up.sql mc_gst_percentage DEFAULT 3.00, and
// MainServerGo/internal/service/tenant_config_service.go's bootstrap: FIXED_INR margin of
// ₹100 + 3% GST) purely so the UI can show a realistic price breakdown instead of the raw
// MCX rate. It is a DISPLAY ESTIMATE ONLY:
// - If a tenant's admin has customized their margin away from the platform default, this
//   will silently disagree with what /trade/buy/initiate actually charges.
// - The backend's slippage check (trade_service.go slippageToleranceINR) compares the
//   *actual* tenant-priced rate against what the customer submits — a tenant with a
//   materially different margin config will still see spurious 409s from this screen.
// - Fixing this correctly requires MainServer to expose the tenant's real priced rate (or
//   at least its margin config) publicly; that's backend work, intentionally out of scope
//   here.
const DEFAULT_MARGIN_INR = 100;
const DEFAULT_GST_PERCENTAGE = 3;

export type TenantPricedRate = {
  finalRatePerGramInr: number;
  mcxBaseRateInr: number;
  marginAppliedInr: number;
  gstAppliedInr: number;
};

// Mirrors MainServerGo/internal/service/trade_service.go's buyPrice() for a FIXED_INR
// margin type — the platform default. PERCENTAGE-type margins aren't replicated here since
// the frontend has no way to know which type a given tenant is on.
export function applyDefaultTenantPricing(mcxAskInr: number): TenantPricedRate {
  const marginAppliedInr = DEFAULT_MARGIN_INR;
  const rateWithMargin = mcxAskInr + marginAppliedInr;
  const gstAppliedInr = rateWithMargin * (DEFAULT_GST_PERCENTAGE / 100);

  return {
    finalRatePerGramInr: rateWithMargin + gstAppliedInr,
    mcxBaseRateInr: mcxAskInr,
    marginAppliedInr,
    gstAppliedInr,
  };
}

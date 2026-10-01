import { applyDefaultTenantPricing, type TenantPricedRate } from './tenantPricing';

type RawMcxFrame = { bid?: unknown; ask?: unknown };

// A gold price can never be zero or negative — treat one as a bad/sentinel tick rather than
// rendering it, e.g. if the backend ever emits an error value in this slot.
function isValidPrice(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

// MainServer's rate feed sends the raw MCX rate as JSON — `{"bid": ..., "ask": ..., ...}`
// (MainServerGo/internal/api/rates/rate_hub.go RateStruct) — while the mock stream
// (market.mock.ts) sends a bare number for simplicity. Either way, this extracts the base
// rate by field name (not "first number in the string" — bid happens to be marshaled before
// ask, which would silently pick the wrong one) and layers the client-side margin/GST
// estimate (tenantPricing.ts) on top, since MainServer doesn't expose the tenant-priced rate.
export function parseRateFrame(raw: string | null | undefined): TenantPricedRate | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as RawMcxFrame;
    if (isValidPrice(parsed.ask)) return applyDefaultTenantPricing(parsed.ask);
  } catch {
    // Not JSON — fall through to the numeric-token fallback below (mock frames, or a bare
    // "data: <price>" frame).
  }

  const match = raw.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const value = Number(match[0]);
  return isValidPrice(value) ? applyDefaultTenantPricing(value) : null;
}

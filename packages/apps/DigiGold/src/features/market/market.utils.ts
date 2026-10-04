import { applyDefaultTenantPricing, type TenantPricedRate } from './tenantPricing';

export type ParsedRateFrame = TenantPricedRate & {
  // Raw MCX sides as received. A legacy scalar frame carries a price but no sides.
  bidPerGramInr: number | null;
  askPerGramInr: number | null;
};

// A gold price can never be zero or negative — treat one as a bad/sentinel tick rather than
// rendering it, e.g. if the backend ever emits an error value in this slot.
function validPrice(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

// Mock frames (and any raw SSE text) arrive as `data: <payload>` lines; EventSource's
// event.data and the REST snapshot arrive as the bare payload. Normalise both.
function extractPayload(raw: string): string {
  const dataLines = raw
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).replace(/^ /, ''));
  return dataLines.length > 0 ? dataLines.join('\n') : raw.trim();
}

// MainServer's rate feed sends the raw MCX rate as JSON — `{"bid": ..., "ask": ..., ...}`
// (MainServerGo/internal/api/rates/rate_hub.go RateStruct) — while the mock stream
// (market.mock.ts) sends a bare number. The purchase price is derived from `ask` by field
// name (not "first number in the string" — bid is marshaled before ask, which would
// silently pick the wrong one) with the client-side margin/GST estimate layered on top
// (tenantPricing.ts), since MainServer doesn't expose the tenant-priced rate.
export function parseRateFrame(raw: string | null | undefined): ParsedRateFrame | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractPayload(raw));
  } catch {
    return null;
  }

  if (typeof parsed === 'number') {
    const price = validPrice(parsed);
    if (price === null) return null;
    return { ...applyDefaultTenantPricing(price), bidPerGramInr: null, askPerGramInr: null };
  }

  if (parsed === null || typeof parsed !== 'object') return null;
  const frame = parsed as { bid?: unknown; ask?: unknown };
  const ask = validPrice(frame.ask);
  if (ask === null) return null;

  return {
    ...applyDefaultTenantPricing(ask),
    bidPerGramInr: validPrice(frame.bid),
    askPerGramInr: ask,
  };
}

// NOTE: candidate for @digigold/core — mirrors MainServer's GET /user/portfolio response
// shape; move it there once packages/libs/core is built and importable.

// MainServer serialises the rate hub's frame straight through as a numeric map
// (see CustomerTradeController.Portfolio), so the keys are whatever the upstream feed
// publishes: `bid`, `ask`, plus the optional `last-high` / `last-low` band.
export type LiveRate = {
  bid: number | null;
  ask: number | null;
  lastHigh: number | null;
  lastLow: number | null;
};

export type Portfolio = {
  balanceGrams: number;
  currentValuationInr: number;
  liveRate: LiveRate;
  // The server stamps no timestamp on the response, so the service records the moment it
  // was fetched — the UI needs it to tell a fresh valuation from a stale one.
  fetchedAt: string;
};

// Raw wire shape. `live_rate` is a bare numeric map and is `null` (not `{}`) whenever the
// rate hub has nothing cached yet, so every field is treated as untrusted on the way in.
export type PortfolioResponse = {
  success: boolean;
  balance_grams: number;
  current_valuation_inr: number;
  live_rate: Record<string, number> | null;
};

export const EMPTY_LIVE_RATE: LiveRate = {
  bid: null,
  ask: null,
  lastHigh: null,
  lastLow: null,
};

// Grams are stored to 4dp on the ledger, so render at the same precision and never show
// more than the backend can actually account for.
export const GRAMS_PRECISION = 4;

// The valuation is a point-in-time number (grams × bid at fetch time), so it goes stale on
// its own. A slow background refetch keeps the headline honest without the SSE burst rate —
// live bid/ask ticking is the stream's job, not this query's. Also quoted in the UI copy.
export const PORTFOLIO_REFETCH_INTERVAL_MS = 30_000;

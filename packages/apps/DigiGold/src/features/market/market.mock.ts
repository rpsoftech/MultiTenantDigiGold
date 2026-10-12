import type { MarketRate } from './market.types';
import { MARKET_PURITY_LABEL } from './market.types';
import { applyDefaultTenantPricing } from './tenantPricing';

// MainServer's live-rate feed is being integrated behind NEXT_PUBLIC_USE_MOCK_MARKET —
// flipping that flag to false in market.service.ts / market.sse.ts is the only change
// needed to go live. Until then this jitters a base (raw MCX) rate to simulate ticks, then
// runs it through the same client-side margin/GST estimate as the real feed.
const BASE_RATE_PER_GRAM_INR = 7120.83;
const MOCK_TICK_INTERVAL_MS = 2_000;
const MOCK_BID_ASK_SPREAD_INR = 4;

function jitteredQuote(): { bid: number; ask: number } {
  const jitter = (Math.random() - 0.5) * 20;
  const ask = Math.round((BASE_RATE_PER_GRAM_INR + jitter) * 100) / 100;
  return { bid: Math.round((ask - MOCK_BID_ASK_SPREAD_INR) * 100) / 100, ask };
}

export async function mockGetLastRate(): Promise<MarketRate> {
  const { bid, ask } = jitteredQuote();
  const priced = applyDefaultTenantPricing(ask);
  return {
    pricePerGramInr: priced.finalRatePerGramInr,
    mcxBaseRateInr: priced.mcxBaseRateInr,
    marginAppliedInr: priced.marginAppliedInr,
    gstAppliedInr: priced.gstAppliedInr,
    bidPerGramInr: bid,
    askPerGramInr: ask,
    purityLabel: MARKET_PURITY_LABEL,
    updatedAt: new Date().toISOString(),
  };
}

// Simulates the SSE stream's raw text frames, in the same {bid, ask} JSON shape as the real
// feed, so market.sse.ts can run a single code path (parse the frame) regardless of whether
// the source is the real EventSource or this mock.
export function mockLiveRateStream(onFrame: (frame: string) => void): () => void {
  const timer = setInterval(() => {
    onFrame(`data: ${JSON.stringify(jitteredQuote())}\n\n`);
  }, MOCK_TICK_INTERVAL_MS);

  return () => clearInterval(timer);
}

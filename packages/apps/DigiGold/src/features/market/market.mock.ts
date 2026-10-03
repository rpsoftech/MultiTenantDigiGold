import type { MarketRate } from './market.types';
import { MARKET_PURITY_LABEL } from './market.types';
import { applyDefaultTenantPricing } from './tenantPricing';

// MainServer's live-rate feed is being integrated behind NEXT_PUBLIC_USE_MOCK_MARKET —
// flipping that flag to false in market.service.ts / market.sse.ts is the only change
// needed to go live. Until then this jitters a base (raw MCX) rate to simulate ticks, then
// runs it through the same client-side margin/GST estimate as the real feed.
const BASE_RATE_PER_GRAM_INR = 7120.83;
const MOCK_TICK_INTERVAL_MS = 2_000;

function jitteredAskPrice(): number {
  const jitter = (Math.random() - 0.5) * 20;
  return Math.round((BASE_RATE_PER_GRAM_INR + jitter) * 100) / 100;
}

export async function mockGetLastRate(): Promise<MarketRate> {
  const priced = applyDefaultTenantPricing(jitteredAskPrice());
  return {
    pricePerGramInr: priced.finalRatePerGramInr,
    mcxBaseRateInr: priced.mcxBaseRateInr,
    marginAppliedInr: priced.marginAppliedInr,
    gstAppliedInr: priced.gstAppliedInr,
    purityLabel: MARKET_PURITY_LABEL,
    updatedAt: new Date().toISOString(),
  };
}

// Simulates the SSE stream's raw text frames so market.sse.ts can run a single code path
// (parse the frame) regardless of whether the source is the real EventSource or this mock.
export function mockLiveRateStream(onFrame: (frame: string) => void): () => void {
  const timer = setInterval(() => {
    onFrame(`data: ${jitteredAskPrice()}\n\n`);
  }, MOCK_TICK_INTERVAL_MS);

  return () => clearInterval(timer);
}

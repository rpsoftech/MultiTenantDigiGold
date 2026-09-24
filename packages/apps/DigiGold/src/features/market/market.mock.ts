import type { MarketRate } from './market.types';
import { MARKET_PURITY_LABEL } from './market.types';

// MainServer's live-rate feed is being integrated behind NEXT_PUBLIC_USE_MOCK_MARKET —
// flipping that flag to false in market.service.ts / market.sse.ts is the only change
// needed to go live. Until then this jitters a base rate to simulate ticks.
const BASE_RATE_PER_GRAM_INR = 7120.83;
const MOCK_TICK_INTERVAL_MS = 2_000;

function jitteredPrice(): number {
  const jitter = (Math.random() - 0.5) * 20;
  return Math.round((BASE_RATE_PER_GRAM_INR + jitter) * 100) / 100;
}

export async function mockGetLastRate(): Promise<MarketRate> {
  return {
    pricePerGramInr: jitteredPrice(),
    purityLabel: MARKET_PURITY_LABEL,
    updatedAt: new Date().toISOString(),
  };
}

// Simulates the SSE stream's raw text frames so market.sse.ts can run a single code path
// (parse the frame) regardless of whether the source is the real EventSource or this mock.
export function mockLiveRateStream(onFrame: (frame: string) => void): () => void {
  const timer = setInterval(() => {
    onFrame(`data: ${jitteredPrice()}\n\n`);
  }, MOCK_TICK_INTERVAL_MS);

  return () => clearInterval(timer);
}

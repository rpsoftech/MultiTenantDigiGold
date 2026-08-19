import type { MarketRate } from './market.types';

// MainServer's live-rate WebSocket feed isn't ready yet — swapping to the real connection
// in market.service.ts is a one-file change (flip NEXT_PUBLIC_USE_MOCK_MARKET). Until then
// this jitters a base rate slightly on every call to simulate a live tick.
const BASE_RATE_PER_GRAM_INR = 7120.83;

export async function mockGetLiveRate(): Promise<MarketRate> {
  const jitter = (Math.random() - 0.5) * 20;
  return {
    pricePerGramInr: Math.round((BASE_RATE_PER_GRAM_INR + jitter) * 100) / 100,
    purityLabel: '24K • 99.99%',
    updatedAt: new Date().toISOString(),
  };
}

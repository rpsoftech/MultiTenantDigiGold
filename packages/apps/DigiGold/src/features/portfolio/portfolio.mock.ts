import type { Portfolio } from './portfolio.types';

// Stand-in for GET /user/portfolio behind NEXT_PUBLIC_USE_MOCK_PORTFOLIO — flipping that
// flag to false is the only change needed to go live. Mirrors the real payload exactly
// (including a `live_rate` map) so the page renders identically either way.
const MOCK_BALANCE_GRAMS = 24.5812;
const MOCK_BID_PER_GRAM_INR = 7120.83;
const MOCK_ASK_PER_GRAM_INR = 7137.5;

export async function mockGetPortfolio(): Promise<Portfolio> {
  const bid = MOCK_BID_PER_GRAM_INR + (Math.random() - 0.5) * 20;
  const ask = bid + (MOCK_ASK_PER_GRAM_INR - MOCK_BID_PER_GRAM_INR);

  return {
    balanceGrams: MOCK_BALANCE_GRAMS,
    // Server values the vault at the raw bid with no tenant margin applied.
    currentValuationInr: Math.round(MOCK_BALANCE_GRAMS * bid * 100) / 100,
    liveRate: {
      bid: Math.round(bid * 100) / 100,
      ask: Math.round(ask * 100) / 100,
      lastHigh: Math.round(Math.max(bid, ask) * 1.004 * 100) / 100,
      lastLow: Math.round(Math.min(bid, ask) * 0.997 * 100) / 100,
    },
    fetchedAt: new Date().toISOString(),
  };
}

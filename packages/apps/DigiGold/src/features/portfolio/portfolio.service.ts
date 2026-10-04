import { apiClient } from '@/lib/api/client';
import type { LiveRate, Portfolio, PortfolioResponse } from './portfolio.types';
import { EMPTY_LIVE_RATE } from './portfolio.types';
import { mockGetPortfolio } from './portfolio.mock';

// Read through a function (like auth.service.ts) rather than a module-level const so tests
// can flip the flag without re-importing the module.
export function shouldUseMockPortfolio() {
  return process.env.NEXT_PUBLIC_USE_MOCK_PORTFOLIO === 'true';
}

// The wire sends bare numbers inside a map, so a missing key and a sentinel 0 are
// indistinguishable. Neither is a usable gold price, so both collapse to null and the UI
// renders a placeholder instead of "₹0".
function toRateNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function toLiveRate(raw: Record<string, number> | null | undefined): LiveRate {
  if (!raw) return EMPTY_LIVE_RATE;

  return {
    bid: toRateNumber(raw.bid),
    ask: toRateNumber(raw.ask),
    lastHigh: toRateNumber(raw['last-high']),
    lastLow: toRateNumber(raw['last-low']),
  };
}

// GET /api/v1/user/portfolio → { success, balance_grams, current_valuation_inr, live_rate }
export const portfolioService = {
  getPortfolio: async (): Promise<Portfolio> => {
    if (shouldUseMockPortfolio()) return mockGetPortfolio();

    const response = await apiClient.get<PortfolioResponse>('/user/portfolio');
    const { balance_grams, current_valuation_inr, live_rate } = response.data;

    return {
      // A negative balance is a ledger bug, not a customer state — clamp rather than
      // surface "-3.2 g" as if it were a real holding.
      balanceGrams: Math.max(balance_grams, 0),
      currentValuationInr: Math.max(current_valuation_inr, 0),
      liveRate: toLiveRate(live_rate),
      fetchedAt: new Date().toISOString(),
    };
  },
};

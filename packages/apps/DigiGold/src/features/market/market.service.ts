import { apiClient } from '@/lib/api/client';
import type { MarketRate } from './market.types';
import { MARKET_PURITY_LABEL } from './market.types';
import { mockGetLastRate } from './market.mock';
import { parseRateFrameToQuote } from './market.utils';

const USE_MOCK_MARKET = process.env.NEXT_PUBLIC_USE_MOCK_MARKET === 'true';

// GET /api/v1/rates/last-rate → { latest_rate: "<sse data frame>" }
type LastRateResponse = { latest_rate: string };

export const marketService = {
  getLastRate: async (): Promise<MarketRate | null> => {
    if (USE_MOCK_MARKET) return mockGetLastRate();

    const response = await apiClient.get<LastRateResponse>('/rates/last-rate');
    const quote = parseRateFrameToQuote(response.data.latest_rate);
    if (quote === null) return null;

    return {
      ...quote,
      purityLabel: MARKET_PURITY_LABEL,
      updatedAt: new Date().toISOString(),
    };
  },
};

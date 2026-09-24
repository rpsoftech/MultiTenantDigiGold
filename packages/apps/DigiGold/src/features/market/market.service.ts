import { apiClient } from '@/lib/api/client';
import type { MarketRate } from './market.types';
import { MARKET_PURITY_LABEL } from './market.types';
import { mockGetLastRate } from './market.mock';
import { parseRateFrameToPrice } from './market.utils';

const USE_MOCK_MARKET = process.env.NEXT_PUBLIC_USE_MOCK_MARKET === 'true';

// GET /api/v1/rates/last-rate → { latest_rate: "<sse data frame>" }
type LastRateResponse = { latest_rate: string };

export const marketService = {
  getLastRate: async (): Promise<MarketRate | null> => {
    if (USE_MOCK_MARKET) return mockGetLastRate();

    const response = await apiClient.get<LastRateResponse>('/rates/last-rate');
    const price = parseRateFrameToPrice(response.data.latest_rate);
    if (price === null) return null;

    return {
      pricePerGramInr: price,
      purityLabel: MARKET_PURITY_LABEL,
      updatedAt: new Date().toISOString(),
    };
  },
};

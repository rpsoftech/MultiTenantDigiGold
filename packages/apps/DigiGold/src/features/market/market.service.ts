import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api.types';
import type { MarketRate } from './market.types';
import { mockGetLiveRate } from './market.mock';

const USE_MOCK_MARKET = process.env.NEXT_PUBLIC_USE_MOCK_MARKET === 'true';

export const marketService = {
  getLiveRate: async (): Promise<MarketRate> => {
    if (USE_MOCK_MARKET) return mockGetLiveRate();
    const response = await apiClient.get<ApiResponse<MarketRate>>('/market/live-rate');
    return response.data.data;
  },
};

import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api.types';
import type { Product } from './marketplace.types';
import { mockGetTrendingProducts } from './marketplace.mock';

const USE_MOCK_MARKETPLACE = process.env.NEXT_PUBLIC_USE_MOCK_MARKETPLACE === 'true';

export const marketplaceService = {
  getTrendingProducts: async (): Promise<Product[]> => {
    if (USE_MOCK_MARKETPLACE) return mockGetTrendingProducts();
    const response = await apiClient.get<ApiResponse<Product[]>>('/marketplace/trending');
    return response.data.data;
  },
};

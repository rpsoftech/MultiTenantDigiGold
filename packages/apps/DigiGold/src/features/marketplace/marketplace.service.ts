import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api.types';
import type { Category, Product } from './marketplace.types';
import { mockGetCategories, mockGetTrendingProducts } from './marketplace.mock';

const USE_MOCK_MARKETPLACE = process.env.NEXT_PUBLIC_USE_MOCK_MARKETPLACE === 'true';

export const marketplaceService = {
  getTrendingProducts: async (): Promise<Product[]> => {
    if (USE_MOCK_MARKETPLACE) return mockGetTrendingProducts();
    const response = await apiClient.get<ApiResponse<Product[]>>('/marketplace/trending');
    return response.data.data;
  },

  getCategories: async (): Promise<Category[]> => {
    if (USE_MOCK_MARKETPLACE) return mockGetCategories();
    const response = await apiClient.get<ApiResponse<Category[]>>('/marketplace/categories');
    return response.data.data;
  },
};

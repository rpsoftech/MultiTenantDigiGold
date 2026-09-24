import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api.types';
import type { Category, Product } from './marketplace.types';
import {
  mockGetCategories,
  mockGetCategoryProducts,
  mockGetAllProducts,
  mockGetProduct,
  mockGetTrendingProducts,
} from './marketplace.mock';

const USE_MOCK_CATEGORY_PRODUCTS =
  process.env.NEXT_PUBLIC_USE_MOCK_MARKETPLACE_CATEGORY === 'true';
const USE_MOCK_MARKETPLACE =
  process.env.NEXT_PUBLIC_USE_MOCK_MARKETPLACE === 'true';

export const marketplaceService = {
  getTrendingProducts: async (): Promise<Product[]> => {
    if (USE_MOCK_MARKETPLACE) return mockGetTrendingProducts();
    const response = await apiClient.get<ApiResponse<Product[]>>(
      '/marketplace/trending',
    );
    return response.data.data;
  },

  getCategories: async (): Promise<Category[]> => {
    if (USE_MOCK_MARKETPLACE) return mockGetCategories();
    const response = await apiClient.get<ApiResponse<Category[]>>(
      '/marketplace/categories',
    );
    return response.data.data;
  },

  getCategoryProducts: async (categoryId: string): Promise<Product[]> => {
    if (USE_MOCK_CATEGORY_PRODUCTS) {
      return mockGetCategoryProducts(categoryId);
    }
    const response = await apiClient.get<ApiResponse<Product[]>>(
      `/marketplace/categories/${categoryId}/products`,
    );
    return response.data.data;
  },

  getProduct: async (productId: string): Promise<Product | null> => {
    if (USE_MOCK_CATEGORY_PRODUCTS) return mockGetProduct(productId);
    const response = await apiClient.get<ApiResponse<Product>>(
      `/marketplace/products/${productId}`,
    );
    return response.data.data;
  },

  getMockProducts: mockGetAllProducts,
};

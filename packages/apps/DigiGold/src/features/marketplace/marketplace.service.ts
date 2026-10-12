import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api.types';
import type { Category, Product } from './marketplace.types';
import {
  mockGetCategories,
  mockGetCategoryProducts,
  mockGetProduct,
  mockGetTrendingProducts,
} from './marketplace.mock';

// MainServer has no /marketplace/* endpoints yet; these flags select the mock catalogue.
// Everything here is called from client components only — never at build time — so the
// static export builds the same with either setting.
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
      `/marketplace/categories/${encodeURIComponent(categoryId)}/products`,
    );
    return response.data.data;
  },

  getProduct: async (productId: string): Promise<Product | null> => {
    if (USE_MOCK_CATEGORY_PRODUCTS) return mockGetProduct(productId);
    const response = await apiClient.get<ApiResponse<Product>>(
      `/marketplace/products/${encodeURIComponent(productId)}`,
    );
    return response.data.data;
  },
};

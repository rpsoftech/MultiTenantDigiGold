import { apiClient } from '@/lib/api/client';
import type { PortfolioResult } from './portfolio.types';

export const portfolioService = {
  getPortfolio: async (): Promise<PortfolioResult> => {
    const response = await apiClient.get<PortfolioResult>('/user/portfolio');
    return response.data;
  },
};

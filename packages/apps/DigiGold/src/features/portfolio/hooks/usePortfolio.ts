import { useQuery } from '@tanstack/react-query';
import { portfolioService } from '../portfolio.service';

// Same key BuyGold already invalidates after a buy settles.
export const PORTFOLIO_QUERY_KEY = ['user', 'portfolio'] as const;

export function usePortfolio(enabled = true) {
  return useQuery({
    queryKey: PORTFOLIO_QUERY_KEY,
    queryFn: portfolioService.getPortfolio,
    enabled,
  });
}

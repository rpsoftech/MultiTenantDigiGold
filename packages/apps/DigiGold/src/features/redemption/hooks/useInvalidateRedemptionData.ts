import { useQueryClient } from '@tanstack/react-query';
import { REDEMPTIONS_QUERY_KEY } from './useRedemptions';
import { PORTFOLIO_QUERY_KEY } from '@/features/portfolio/hooks/usePortfolio';

// A redemption (and its cancellation) moves grams in or out of the vault, so the balance,
// the redemption list and the passbook ledger all go stale together.
export function useInvalidateRedemptionData() {
  const queryClient = useQueryClient();

  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: REDEMPTIONS_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: PORTFOLIO_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: ['trade', 'history'] }),
    ]);
}

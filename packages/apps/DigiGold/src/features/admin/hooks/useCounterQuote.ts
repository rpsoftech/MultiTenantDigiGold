import { useMutation } from '@tanstack/react-query';
import { adminService } from '../admin.service';

// Prices a counter sale at the store's own rate. Pricing records nothing, so unlike
// useCounterTrade it leaves the ledger, customers and analytics alone.
export function useCounterQuote() {
  return useMutation({ mutationFn: adminService.quoteCounterTrade });
}

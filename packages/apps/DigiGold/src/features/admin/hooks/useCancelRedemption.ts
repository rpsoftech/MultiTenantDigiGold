import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminService } from '../admin.service';
import { adminQueryKeys } from '../admin.queryKeys';

export function useCancelRedemption() {
  const queryClient = useQueryClient();

  // Cancelling reverses the redemption's ledger debit: it adds a ledger row, returns the grams
  // to the customer's vault and moves store totals. Also refresh on failure, because a 409
  // means the request was already collected or cancelled.
  return useMutation({
    mutationFn: adminService.cancelRedemption,
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: adminQueryKeys.redemptionsPending,
        }),
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.ledger }),
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.customers }),
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.analytics }),
      ]),
  });
}

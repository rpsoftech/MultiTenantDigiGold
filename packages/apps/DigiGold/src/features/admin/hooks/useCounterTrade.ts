import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminService } from '../admin.service';
import { adminQueryKeys } from '../admin.queryKeys';

export function useCounterTrade() {
  const queryClient = useQueryClient();

  // A counter sale adds a ledger row, raises the customer's vault balance and moves the
  // store totals. Also refresh on failure: a rejected sale may mean our data is stale.
  return useMutation({
    mutationFn: adminService.createCounterTrade,
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.ledger }),
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.customers }),
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.analytics }),
      ]),
  });
}

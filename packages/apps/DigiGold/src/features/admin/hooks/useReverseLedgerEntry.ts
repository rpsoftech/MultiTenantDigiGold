import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminService } from '../admin.service';
import { adminQueryKeys } from '../admin.queryKeys';

export function useReverseLedgerEntry() {
  const queryClient = useQueryClient();

  // A reversal adds a ledger row and changes customer balances and store totals.
  // Also refresh on failure: a 409 means our copy of the ledger is stale.
  return useMutation({
    mutationFn: adminService.reverseLedgerEntry,
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.ledger }),
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.customers }),
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.analytics }),
      ]),
  });
}

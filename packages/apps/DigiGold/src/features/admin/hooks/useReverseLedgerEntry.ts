import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminService } from '../admin.service';
import { adminQueryKeys } from '../admin.queryKeys';
import type { AdminLedgerEntry, StorePage } from '../admin.types';

export function useReverseLedgerEntry() {
  const queryClient = useQueryClient();

  // A reversal adds a ledger row and changes customer balances and store totals; reversing
  // a pickup's debit also cancels the pickup, so it leaves the pending list.
  // Also refresh on failure: a 409 means our copy of the ledger is stale.
  return useMutation({
    mutationFn: adminService.reverseLedgerEntry,
    onSuccess: (_result, ledgerId) => {
      queryClient.setQueriesData<StorePage<AdminLedgerEntry>>(
        { queryKey: adminQueryKeys.ledger },
        (page) =>
          page && {
            ...page,
            items: page.items.map((entry) =>
              entry.id === ledgerId ? { ...entry, isReversed: true } : entry,
            ),
          },
      );
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.ledger }),
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.customers }),
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.analytics }),
        queryClient.invalidateQueries({
          queryKey: adminQueryKeys.redemptionsPending,
        }),
      ]),
  });
}

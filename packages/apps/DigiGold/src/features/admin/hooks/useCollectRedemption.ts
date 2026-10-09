import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminService } from '../admin.service';
import { adminQueryKeys } from '../admin.queryKeys';

export function useCollectRedemption() {
  const queryClient = useQueryClient();

  // Collecting leaves the pending list, and a collected redemption can no longer be reversed,
  // so the ledger's reverse hint changes too. Also refresh on failure: a 409 or 404 means
  // someone else already handled it and our list is stale. A wrong code refreshes harmlessly.
  return useMutation({
    mutationFn: adminService.collectRedemption,
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: adminQueryKeys.redemptionsPending,
        }),
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.ledger }),
      ]),
  });
}

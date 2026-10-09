import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminService } from '../admin.service';
import { adminQueryKeys } from '../admin.queryKeys';

export function useUpdateKycStatus() {
  const queryClient = useQueryClient();

  // A decision leaves the review queue and changes the customer's directory status. Also
  // refresh on failure: a 403/404 means the customer is gone or already handled by another
  // admin, so our copy of the queue is stale.
  return useMutation({
    mutationFn: adminService.updateKycStatus,
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.kycPending }),
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.customers }),
      ]),
  });
}

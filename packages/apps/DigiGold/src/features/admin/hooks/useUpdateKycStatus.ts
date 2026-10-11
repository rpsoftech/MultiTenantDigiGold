import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminService } from '../admin.service';
import { adminQueryKeys } from '../admin.queryKeys';

export function useUpdateKycStatus() {
  const queryClient = useQueryClient();

  // A decision leaves the review queue and changes the customer's directory status. Also
  // refresh on failure: 409 KYC_NOT_AWAITING_REVIEW means another admin decided first and
  // 403/404 that the customer left the store, so our copy of the queue is stale.
  return useMutation({
    mutationFn: adminService.updateKycStatus,
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.kycPending }),
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.customers }),
      ]),
  });
}

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminService } from '../admin.service';
import { adminQueryKeys } from '../admin.queryKeys';

export function useUpdateKycStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: adminService.updateKycStatus,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.customers }),
  });
}

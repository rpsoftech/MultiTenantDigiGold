import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminService } from '../admin.service';
import { ADMIN_USERS_QUERY_KEY } from './useAdminUsers';

export function useUpdateKycStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: adminService.updateKycStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_USERS_QUERY_KEY });
    },
  });
}

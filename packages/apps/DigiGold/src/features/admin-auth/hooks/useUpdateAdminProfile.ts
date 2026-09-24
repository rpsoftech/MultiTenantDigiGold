import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAuthService } from '../admin-auth.service';
import { ADMIN_PROFILE_QUERY_KEY } from './useAdminProfile';

export function useUpdateAdminProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: adminAuthService.updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_PROFILE_QUERY_KEY });
    },
  });
}

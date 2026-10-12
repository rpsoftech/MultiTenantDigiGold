import { useMutation } from '@tanstack/react-query';
import { adminAuthService } from '../admin-auth.service';

export function useAdminLogin() {
  return useMutation({
    mutationFn: adminAuthService.login,
    gcTime: 0,
  });
}

import { useMutation } from '@tanstack/react-query';
import { adminAuthService } from '../admin-auth.service';

export function useUpdateAdminPassword() {
  return useMutation({
    mutationFn: adminAuthService.updatePassword,
  });
}

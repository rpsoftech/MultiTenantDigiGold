import { useMutation } from '@tanstack/react-query';
import { adminAuthService } from '../admin-auth.service';

export function useAdminTotpSetup() {
  return useMutation({
    mutationFn: adminAuthService.setupTotp,
    gcTime: 0,
  });
}

import { useQuery } from '@tanstack/react-query';
import { adminService } from '../admin.service';
import { adminQueryKeys } from '../admin.queryKeys';

export function usePendingKyc(page = 1, limit = 20) {
  return useQuery({
    queryKey: adminQueryKeys.kycPendingPage(page, limit),
    queryFn: () => adminService.getPendingKyc(page, limit),
  });
}

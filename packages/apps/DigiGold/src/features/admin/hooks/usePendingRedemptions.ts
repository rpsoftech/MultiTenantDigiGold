import { useQuery } from '@tanstack/react-query';
import { adminService } from '../admin.service';
import { adminQueryKeys } from '../admin.queryKeys';

// phone is the already-normalised 10-digit search ('' lists every pending pickup).
export function usePendingRedemptions(page = 1, limit = 20, phone = '') {
  return useQuery({
    queryKey: adminQueryKeys.redemptionsPendingPage(page, limit, phone),
    queryFn: () => adminService.getPendingRedemptions(page, limit, phone),
  });
}

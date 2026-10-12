import { useQuery } from '@tanstack/react-query';
import { adminService } from '../admin.service';
import { adminQueryKeys } from '../admin.queryKeys';

// Today's (IST) handovers at the counter, newest first.
export function useCollectedRedemptions(page = 1, limit = 20) {
  return useQuery({
    queryKey: adminQueryKeys.redemptionsCollectedPage(page, limit),
    queryFn: () => adminService.getCollectedRedemptions(page, limit),
  });
}

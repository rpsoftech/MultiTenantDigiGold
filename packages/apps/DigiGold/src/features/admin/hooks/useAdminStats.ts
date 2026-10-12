import { useQuery } from '@tanstack/react-query';
import { adminService } from '../admin.service';
import { adminQueryKeys } from '../admin.queryKeys';

export function useAdminStats() {
  return useQuery({
    queryKey: adminQueryKeys.analytics,
    queryFn: adminService.getAdminStats,
  });
}

import { useQuery } from '@tanstack/react-query';
import { adminService } from '../admin.service';
import { adminQueryKeys } from '../admin.queryKeys';

export function useRecentUsers() {
  return useQuery({
    queryKey: adminQueryKeys.customerPage(1, 5),
    queryFn: () => adminService.getAdminUsers(1, 5),
    select: (result) => result.items,
  });
}

import { useQuery } from '@tanstack/react-query';
import { adminService } from '../admin.service';
import { adminQueryKeys } from '../admin.queryKeys';

export function useAdminUsers(page = 1, limit = 20) {
  return useQuery({
    queryKey: adminQueryKeys.customerPage(page, limit),
    queryFn: () => adminService.getAdminUsers(page, limit),
  });
}

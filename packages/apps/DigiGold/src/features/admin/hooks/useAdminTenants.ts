import { useQuery } from '@tanstack/react-query';
import { adminService } from '../admin.service';
import { adminQueryKeys } from '../admin.queryKeys';

export function useAdminTenants() {
  return useQuery({
    queryKey: adminQueryKeys.auditTenants,
    queryFn: () => adminService.getAdminTenants(),
    staleTime: 5 * 60 * 1000,
  });
}

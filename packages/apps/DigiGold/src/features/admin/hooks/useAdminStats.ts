import { useQuery } from '@tanstack/react-query';
import { adminService } from '../admin.service';

export function useAdminStats() {
  return useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: adminService.getAdminStats,
  });
}

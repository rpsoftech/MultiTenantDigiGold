import { useQuery } from '@tanstack/react-query';
import { adminService } from '../admin.service';

export function useRecentUsers() {
  return useQuery({
    queryKey: ['admin', 'recent-users'],
    queryFn: adminService.getRecentUsers,
  });
}

import { useQuery } from '@tanstack/react-query';
import { adminService } from '../admin.service';

export const ADMIN_USERS_QUERY_KEY = ['admin', 'users'];

export function useAdminUsers() {
  return useQuery({
    queryKey: ADMIN_USERS_QUERY_KEY,
    queryFn: adminService.getAdminUsers,
  });
}

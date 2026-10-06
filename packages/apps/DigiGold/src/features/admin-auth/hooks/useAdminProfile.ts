import { useQuery } from '@tanstack/react-query';
import { adminAuthService } from '../admin-auth.service';

export const ADMIN_PROFILE_QUERY_KEY = ['admin', 'profile'];

export function useAdminProfile() {
  return useQuery({
    queryKey: ADMIN_PROFILE_QUERY_KEY,
    queryFn: adminAuthService.getProfile,
  });
}

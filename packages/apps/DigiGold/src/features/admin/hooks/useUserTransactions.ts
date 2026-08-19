import { useQuery } from '@tanstack/react-query';
import { adminService } from '../admin.service';

export function useUserTransactions(userId: string | null) {
  return useQuery({
    queryKey: ['admin', 'user-transactions', userId],
    queryFn: () => adminService.getUserTransactions(userId as string),
    enabled: userId !== null,
  });
}

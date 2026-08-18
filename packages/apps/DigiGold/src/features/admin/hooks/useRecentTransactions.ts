import { useQuery } from '@tanstack/react-query';
import { adminService } from '../admin.service';

export function useRecentTransactions() {
  return useQuery({
    queryKey: ['admin', 'recent-transactions'],
    queryFn: adminService.getRecentTransactions,
  });
}

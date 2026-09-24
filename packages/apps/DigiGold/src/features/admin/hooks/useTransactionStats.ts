import { useQuery } from '@tanstack/react-query';
import { adminService } from '../admin.service';

export function useTransactionStats() {
  return useQuery({
    queryKey: ['admin', 'transaction-stats'],
    queryFn: adminService.getTransactionStats,
  });
}

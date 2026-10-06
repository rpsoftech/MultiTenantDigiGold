import { useQuery } from '@tanstack/react-query';
import { adminService } from '../admin.service';
import { adminQueryKeys } from '../admin.queryKeys';

export function useRecentTransactions() {
  return useQuery({
    queryKey: adminQueryKeys.ledgerPage(1, 5),
    queryFn: () => adminService.getStoreLedger(1, 5),
    select: (result) => result.items,
  });
}

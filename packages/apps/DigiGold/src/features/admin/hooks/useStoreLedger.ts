import { useQuery } from '@tanstack/react-query';
import { adminService } from '../admin.service';
import { adminQueryKeys } from '../admin.queryKeys';

export function useStoreLedger(page = 1, limit = 20) {
  return useQuery({
    queryKey: adminQueryKeys.ledgerPage(page, limit),
    queryFn: () => adminService.getStoreLedger(page, limit),
  });
}

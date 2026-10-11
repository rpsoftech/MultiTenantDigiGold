import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminService } from '../admin.service';
import { adminQueryKeys } from '../admin.queryKeys';
import type { AuditEventFilters } from '../admin.types';

export function useAuditEvents(
  filters: AuditEventFilters,
  page = 1,
  limit = 20,
) {
  return useQuery({
    queryKey: adminQueryKeys.auditEventsPage(filters, page, limit),
    queryFn: () => adminService.getAuditEvents(filters, page, limit),
    // Keep the current rows on screen while the next page or filter loads.
    placeholderData: keepPreviousData,
  });
}

import { useInfiniteQuery } from '@tanstack/react-query';
import { adminService } from '../admin.service';
import { adminQueryKeys } from '../admin.queryKeys';

// MainServer has no customer search, so the picker loads the largest page it allows and
// pulls further pages on demand; the search box then filters what has been loaded.
const PICKER_PAGE_SIZE = 100;

export function useCustomerPicker() {
  const query = useInfiniteQuery({
    queryKey: adminQueryKeys.customerPicker,
    queryFn: ({ pageParam }) =>
      adminService.getAdminUsers(pageParam, PICKER_PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasNextPage ? lastPage.page + 1 : undefined,
  });

  return {
    ...query,
    customers: query.data?.pages.flatMap((page) => page.items) ?? [],
  };
}

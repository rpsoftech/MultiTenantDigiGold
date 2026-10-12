import { useInfiniteQuery } from '@tanstack/react-query';
import { useSession } from '@/features/auth/hooks/useSession';
import { tradeService } from '../trade.service';

const PAGE_LIMIT = 20;

export function useTradeHistory({ enabled = true }: { enabled?: boolean } = {}) {
  const { user, sessionRevision } = useSession();
  const query = useInfiniteQuery({
    // Per customer session (['trade', 'history'] still invalidates it), so one customer's
    // passbook is never shown to the next who signs in on this browser.
    queryKey: ['trade', 'history', user?.userId ?? '', sessionRevision],
    queryFn: ({ pageParam }) => tradeService.getHistory({ page: pageParam, limit: PAGE_LIMIT }),
    initialPageParam: 1,
    enabled,
    // Older MainServer builds marshal an empty history as `"data": null`, not `[]`.
    getNextPageParam: (lastPage) =>
      (lastPage.data ?? []).length < PAGE_LIMIT ? undefined : lastPage.page + 1,
  });

  const entries = query.data?.pages.flatMap((page) => page.data ?? []) ?? [];

  return { ...query, entries };
}

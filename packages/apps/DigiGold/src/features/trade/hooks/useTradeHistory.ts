import { useInfiniteQuery } from '@tanstack/react-query';
import { tradeService } from '../trade.service';

const PAGE_LIMIT = 20;

export function useTradeHistory() {
  const query = useInfiniteQuery({
    queryKey: ['trade', 'history'],
    queryFn: ({ pageParam }) => tradeService.getHistory({ page: pageParam, limit: PAGE_LIMIT }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.data.length < PAGE_LIMIT ? undefined : lastPage.page + 1,
  });

  const entries = query.data?.pages.flatMap((page) => page.data) ?? [];

  return { ...query, entries };
}

import { useInfiniteQuery } from '@tanstack/react-query';
import { redemptionService } from '../redemption.service';

const PAGE_LIMIT = 20;

export const REDEMPTIONS_QUERY_KEY = ['redemptions'] as const;

export function useRedemptions() {
  const query = useInfiniteQuery({
    queryKey: REDEMPTIONS_QUERY_KEY,
    queryFn: ({ pageParam }) =>
      redemptionService.list({ page: pageParam, limit: PAGE_LIMIT }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.data.length < PAGE_LIMIT ? undefined : lastPage.page + 1,
  });

  const redemptions = query.data?.pages.flatMap((page) => page.data) ?? [];

  return { ...query, redemptions };
}

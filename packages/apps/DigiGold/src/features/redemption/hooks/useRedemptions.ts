import { useInfiniteQuery } from '@tanstack/react-query';
import { useSession } from '@/features/auth/hooks/useSession';
import { redemptionService } from '../redemption.service';

const PAGE_LIMIT = 20;

// Prefix of the redemptions query. Each customer session gets its own entry under it: the
// list holds pickup codes, which must never be shown to the next customer on this browser.
export const REDEMPTIONS_QUERY_KEY = ['redemptions'] as const;

export function useRedemptions() {
  const { user, sessionRevision } = useSession();
  const query = useInfiniteQuery({
    queryKey: [...REDEMPTIONS_QUERY_KEY, user?.userId ?? '', sessionRevision],
    queryFn: ({ pageParam }) =>
      redemptionService.list({ page: pageParam, limit: PAGE_LIMIT }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.data.length < PAGE_LIMIT ? undefined : lastPage.page + 1,
  });

  const redemptions = query.data?.pages.flatMap((page) => page.data) ?? [];

  return { ...query, redemptions };
}

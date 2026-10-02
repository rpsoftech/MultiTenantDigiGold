import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { portfolioService, shouldUseMockPortfolio } from '../portfolio.service';
import { useSession } from '@/features/auth/hooks/useSession';
import { describeApiError, isNormalizedApiError } from '@/lib/api/client';

// The valuation is a point-in-time number (grams × bid at fetch time), so it goes stale on
// its own. A slow background refetch keeps the headline honest without the SSE burst rate —
// live bid/ask ticking is the stream's job, not this query's.
const REFETCH_INTERVAL_MS = 30_000;

function isUnauthorized(error: unknown) {
  return isNormalizedApiError(error) && error.status === 401;
}

export function usePortfolio() {
  const { isAuthenticated, sessionRevision } = useSession();
  const isMock = shouldUseMockPortfolio();
  const scope = `${sessionRevision}:${isMock}:${isAuthenticated}`;
  const [lastError, setLastError] = useState<{
    scope: string;
    error: unknown;
  } | null>(null);

  const { data, isFetching, isFetched, isError, error, refetch } = useQuery({
    queryKey: ['portfolio', isMock ? 'mock' : 'live', sessionRevision],
    queryFn: portfolioService.getPortfolio,
    // Both the demo and live vault open only after sign-in.
    enabled: (query) => isAuthenticated && !isUnauthorized(query.state.error),
    // An unavailable server or a rejected session needs an actionable error immediately.
    // Give transient server failures one retry; polling/manual retry can recover later.
    retry: (failureCount, failure) =>
      failureCount < 1 &&
      isNormalizedApiError(failure) &&
      failure.status !== null &&
      failure.status >= 500,
    retryDelay: 1_000,
    refetchInterval: REFETCH_INTERVAL_MS,
    refetchOnWindowFocus: true,
  });

  // React Query clears an initial error when refetch starts. Keep its explanation visible
  // while a manual retry or the next poll is in flight, until a request succeeds.
  useEffect(() => {
    if (error) setLastError({ scope, error });
    else if (data && !isFetching) setLastError(null);
  }, [data, error, isFetching, scope]);

  const visibleError =
    error ?? (lastError?.scope === scope ? lastError.error : null);
  const canViewPortfolio = isAuthenticated && !isUnauthorized(visibleError);

  return {
    portfolio: canViewPortfolio ? (data ?? null) : null,
    isLoading: isFetching && !isFetched,
    isFetching,
    isError: (isError || visibleError !== null) && isAuthenticated,
    // Rejections are plain NormalizedApiError objects, not Errors — this reads the real
    // reason (offline / 401 / 5xx) instead of masking it behind generic copy.
    error: describeApiError(visibleError),
    isAuthenticated: canViewPortfolio,
    isMock,
    refetch,
  };
}

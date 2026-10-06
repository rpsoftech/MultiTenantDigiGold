'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/common/Button/Button';
import { Loader } from '@/components/common/Loader/Loader';
import { VaultUnavailableState } from '@/components/portfolio/VaultStates/VaultStates';
import { useSessionGate } from '@/features/auth/hooks/useSessionGate';
import { useTenantConfig } from '@/features/tenant/hooks/useTenantConfig';
import { useTradeHistory } from '@/features/trade/hooks/useTradeHistory';
import type { TradeEventType } from '@/features/trade/trade.types';
import { ROUTES } from '@/lib/constants/routes';
import { cn } from '@/lib/utils/cn';
import { PassbookEntry } from './PassbookEntry';
import styles from './Passbook.module.scss';

type FilterValue = 'ALL' | TradeEventType;

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'GOLD_PURCHASE', label: 'Purchases' },
  { value: 'PHYSICAL_REDEMPTION', label: 'Redemptions' },
  { value: 'SYSTEM_REVERSAL', label: 'Reversals' },
  { value: 'ADMIN_ADJUSTMENT', label: 'Adjustments' },
];

export function Passbook() {
  const router = useRouter();
  const tenantConfig = useTenantConfig();
  const { isReady } = useSessionGate();
  const vaultEnabled = tenantConfig?.activeModules.vault ?? true;
  const [filter, setFilter] = useState<FilterValue>('ALL');
  const {
    entries,
    isLoading,
    isError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useTradeHistory({ enabled: isReady && vaultEnabled });
  const sentinelRef = useRef<HTMLDivElement>(null);

  const filteredEntries =
    filter === 'ALL'
      ? entries
      : entries.filter((entry) => entry.event_type === filter);

  // Backend doesn't support filtering by event type, so pagination is driven off the
  // unfiltered set — this only auto-advances the underlying fetch, the filter itself is
  // applied to whatever pages have already loaded. The sentinel stays mounted while a
  // filter has no matches yet, so it keeps pulling older pages until one turns up or the
  // history runs out.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasNextPage) return;

    const observer = new IntersectionObserver(
      (observedEntries) => {
        if (observedEntries[0]?.isIntersecting && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // The nav hides vault pages for a tenant without the module; a typed or bookmarked URL
  // gets the same explanation as /vault instead of a working passbook.
  if (!vaultEnabled) {
    return <VaultUnavailableState onGoHome={() => router.push(ROUTES.home)} />;
  }

  const emptyMessage =
    filter === 'ALL'
      ? 'No transactions recorded yet.'
      : hasNextPage
        ? 'No matching entries yet — checking older transactions…'
        : 'No entries match this filter.';

  return (
    <section className={styles.section}>
      <h1 className={styles.heading}>Passbook</h1>

      <div className={styles.filterRow}>
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            className={cn(
              styles.filterChip,
              filter === item.value && styles.filterChipActive,
            )}
            onClick={() => setFilter(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {!isReady || isLoading ? (
        <div className={styles.stateRow}>
          <Loader label="Loading passbook" />
        </div>
      ) : isError ? (
        <p className={styles.emptyState}>
          Couldn&apos;t load your passbook. Please try again.
        </p>
      ) : (
        <>
          {filteredEntries.length === 0 ? (
            <p className={styles.emptyState}>{emptyMessage}</p>
          ) : (
            <div className={styles.entryList}>
              {filteredEntries.map((entry) => (
                <PassbookEntry key={entry.gl_uuid} entry={entry} />
              ))}
            </div>
          )}

          <div ref={sentinelRef} />

          {hasNextPage && (
            <Button
              variant="secondary"
              className={styles.loadMoreButton}
              disabled={isFetchingNextPage}
              onClick={() => fetchNextPage()}
            >
              {isFetchingNextPage ? 'Loading…' : 'Load more'}
            </Button>
          )}
        </>
      )}
    </section>
  );
}

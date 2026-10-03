'use client';

import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/common/Card/Card';
import { Button } from '@/components/common/Button/Button';
import { Loader } from '@/components/common/Loader/Loader';
import { useTradeHistory } from '@/features/trade/hooks/useTradeHistory';
import type { TradeEventType } from '@/features/trade/trade.types';
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
  const [filter, setFilter] = useState<FilterValue>('ALL');
  const {
    entries,
    isLoading,
    isError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useTradeHistory();
  const sentinelRef = useRef<HTMLDivElement>(null);

  const filteredEntries =
    filter === 'ALL'
      ? entries
      : entries.filter((entry) => entry.event_type === filter);

  // Backend doesn't support filtering by event type, so pagination is driven off the
  // unfiltered set — this only auto-advances the underlying fetch, the filter itself is
  // applied to whatever pages have already loaded.
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

      {isLoading ? (
        <div className={styles.stateRow}>
          <Loader label="Loading passbook" />
        </div>
      ) : isError ? (
        <p className={styles.emptyState}>
          Couldn&apos;t load your passbook. Please try again.
        </p>
      ) : filteredEntries.length === 0 ? (
        <p className={styles.emptyState}>
          {filter === 'ALL'
            ? 'No transactions recorded yet.'
            : 'No entries match this filter.'}
        </p>
      ) : (
        <>
          <div className={styles.entryList}>
            {filteredEntries.map((entry) => (
              <PassbookEntry key={entry.gl_uuid} entry={entry} />
            ))}
          </div>

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

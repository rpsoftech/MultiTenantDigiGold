'use client';

import { Button } from '@/components/common/Button/Button';
import { Loader } from '@/components/common/Loader/Loader';
import { useRedemptions } from '@/features/redemption/hooks/useRedemptions';
import { RedemptionCard } from './RedemptionCard';
import styles from './RedemptionList.module.scss';

export function RedemptionList() {
  const {
    redemptions,
    isLoading,
    isError,
    refetch,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useRedemptions();

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>Your redemptions</h2>

      {isLoading ? (
        <div className={styles.stateRow}>
          <Loader label="Loading redemptions" />
        </div>
      ) : isError ? (
        <div className={styles.stateRow}>
          <p className={styles.emptyState}>
            Couldn&apos;t load your redemptions.
          </p>
          <Button
            type="button"
            variant="secondary"
            className={styles.smallButton}
            onClick={() => void refetch()}
          >
            Try again
          </Button>
        </div>
      ) : redemptions.length === 0 ? (
        <p className={styles.emptyState}>No redemptions yet.</p>
      ) : (
        <>
          <div className={styles.list}>
            {redemptions.map((redemption) => (
              <RedemptionCard
                key={redemption.redemption_uuid}
                redemption={redemption}
              />
            ))}
          </div>

          {hasNextPage && (
            <Button
              type="button"
              variant="secondary"
              className={styles.smallButton}
              disabled={isFetchingNextPage}
              onClick={() => void fetchNextPage()}
            >
              {isFetchingNextPage ? 'Loading…' : 'Load more'}
            </Button>
          )}
        </>
      )}
    </section>
  );
}

'use client';

import { Button } from '@/components/common/Button/Button';
import { Loader } from '@/components/common/Loader/Loader';
import { useSessionGate } from '@/features/auth/hooks/useSessionGate';
import { usePortfolio } from '@/features/portfolio/hooks/usePortfolio';
import { RedeemFlow } from './RedeemFlow';
import { RedemptionList } from './RedemptionList';
import styles from './Redemptions.module.scss';

export function Redemptions() {
  const { isReady } = useSessionGate();
  // Staging's shared portfolio hook: enabled only for an authenticated session, and
  // returns the already-normalised Portfolio (balanceGrams), or null on failure.
  const { portfolio, isLoading, isFetching, refetch } = usePortfolio();

  if (!isReady || (!portfolio && isLoading)) {
    return (
      <div className={styles.stateRow}>
        <Loader label="Loading your vault" />
      </div>
    );
  }

  if (!portfolio) {
    return (
      <div className={styles.stateRow}>
        <p className={styles.message}>Couldn&apos;t load your vault balance.</p>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void refetch()}
          isLoading={isFetching}
        >
          Try again
        </Button>
      </div>
    );
  }

  return (
    <section className={styles.section}>
      <h1 className={styles.heading}>Redeem gold</h1>
      <div className={styles.layout}>
        <aside className={styles.flowPane}>
          <RedeemFlow balanceGrams={portfolio.balanceGrams} />
        </aside>
        <div className={styles.listPane}>
          <RedemptionList />
        </div>
      </div>
    </section>
  );
}

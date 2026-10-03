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
  const portfolio = usePortfolio(isReady);

  if (!isReady || portfolio.isLoading) {
    return (
      <div className={styles.stateRow}>
        <Loader label="Loading your vault" />
      </div>
    );
  }

  if (portfolio.isError || !portfolio.data) {
    return (
      <div className={styles.stateRow}>
        <p className={styles.message}>Couldn&apos;t load your vault balance.</p>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void portfolio.refetch()}
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
          <RedeemFlow balanceGrams={portfolio.data.balance_grams} />
        </aside>
        <div className={styles.listPane}>
          <RedemptionList />
        </div>
      </div>
    </section>
  );
}

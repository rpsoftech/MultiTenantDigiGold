'use client';

import { Card } from '@/components/common/Card/Card';
import { Loader } from '@/components/common/Loader/Loader';
import { useTransactionStats } from '@/features/admin/hooks/useTransactionStats';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { cn } from '@/lib/utils/cn';
import type { PeriodMetric } from '@/features/admin/admin.types';
import styles from './TransactionStatsPanel.module.scss';

const SUB_PERIODS: Array<{ key: 'today' | 'last7Days' | 'last30Days'; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: 'last7Days', label: 'Last 7 Days' },
  { key: 'last30Days', label: 'Last 30 Days' },
];

function SubTile({ label, metric }: { label: string; metric: PeriodMetric }) {
  return (
    <div className={styles.subTile}>
      <p className={styles.subLabel}>{label}</p>
      <div className={styles.subValueRow}>
        <p className={styles.subAmount}>{formatCurrency(metric.amountInr, 'INR')}</p>
        <p className={styles.subGrams}>{metric.grams.toFixed(4)} g</p>
      </div>
    </div>
  );
}

export function TransactionStatsPanel() {
  const { data: stats, isLoading } = useTransactionStats();

  if (isLoading || !stats) {
    return <Loader />;
  }

  return (
    <section className={styles.panel}>
      <Card className={cn(styles.lifetimeCard, styles.lifetimeCardBrand)}>
        <p className={styles.lifetimeLabel}>Lifetime Transactions</p>
        <div className={styles.lifetimeValueRow}>
          <p className={styles.lifetimeAmount}>{formatCurrency(stats.lifetime.amountInr, 'INR')}</p>
          <p className={styles.lifetimeGrams}>{stats.lifetime.grams.toFixed(4)} g</p>
        </div>
      </Card>

      <Card className={styles.subCard}>
        {SUB_PERIODS.map(({ key, label }) => (
          <SubTile key={key} label={label} metric={stats[key]} />
        ))}
      </Card>
    </section>
  );
}

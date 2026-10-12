'use client';

import { Card } from '@/components/common/Card/Card';
import { Button } from '@/components/common/Button/Button';
import {
  CoinsIcon,
  WalletIcon,
  GemIcon,
  ClockIcon,
} from '@/components/common/icons/Icons';
import { useAdminStats } from '@/features/admin/hooks/useAdminStats';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { cn } from '@/lib/utils/cn';
import styles from './AdminStatsGrid.module.scss';

export function AdminStatsGrid() {
  const {
    data: stats,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useAdminStats();

  if (isLoading) {
    return (
      <div
        className={styles.grid}
        role="status"
        aria-label="Loading store analytics"
      >
        {Array.from({ length: 4 }, (_, index) => (
          <Card key={index} className={styles.tile} aria-hidden="true">
            <div className={styles.skeletonLabel} />
            <div className={styles.skeletonValue} />
            <div className={styles.skeletonLabel} />
          </Card>
        ))}
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <Card className={styles.errorState}>
        <p role="alert">
          Store analytics couldn’t be loaded. Please try again.
        </p>
        <Button
          variant="outlined"
          disabled={isFetching}
          onClick={() => void refetch()}
        >
          Retry analytics
        </Button>
      </Card>
    );
  }

  const metrics = [
    {
      label: 'Total gold volume',
      value: `${stats.totalVolumeGrams.toLocaleString('en-IN', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} g`,
      hint: 'Gold purchased and redeemed, excluding reversals',
      icon: CoinsIcon,
      featured: true,
    },
    {
      label: 'Total revenue',
      value: formatCurrency(stats.totalRevenueInr, 'INR', 2),
      hint: 'Transaction value, excluding reversals',
      icon: WalletIcon,
    },
    {
      label: 'Margin earned',
      value: formatCurrency(stats.totalMarginEarned, 'INR', 2),
      hint: 'Total store margin',
      icon: GemIcon,
    },
    {
      label: 'Total transactions',
      value: stats.totalTransactions.toLocaleString('en-IN'),
      hint: 'Purchases and redemptions, excluding reversals',
      icon: ClockIcon,
    },
  ];

  return (
    <div className={styles.grid}>
      {metrics.map(({ label, value, hint, icon: Icon, featured }) => (
        <Card
          key={label}
          className={cn(styles.tile, featured && styles.featured)}
        >
          <div className={styles.tileHeader}>
            <p className={styles.label}>{label}</p>
            <span className={styles.icon}>
              <Icon width={20} height={20} />
            </span>
          </div>
          <p className={styles.value}>{value}</p>
          <p className={styles.hint}>{hint}</p>
        </Card>
      ))}
    </div>
  );
}

'use client';

import { Card } from '@/components/common/Card/Card';
import { Loader } from '@/components/common/Loader/Loader';
import { useAdminStats } from '@/features/admin/hooks/useAdminStats';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { cn } from '@/lib/utils/cn';
import styles from './AdminStatsGrid.module.scss';

export function AdminStatsGrid() {
  const { data: stats, isLoading } = useAdminStats();

  if (isLoading || !stats) {
    return <Loader />;
  }

  return (
    <div className={styles.grid}>
      <Card className={styles.tile}>
        <p className={styles.label}>Total Vaulted Gold</p>
        <p className={cn(styles.value, styles.brandValue)}>
          {stats.totalVaultedGoldGrams.toFixed(4)} g
        </p>
        <p className={styles.hint}>100% Backed by Physical Vaults</p>
      </Card>

      <Card className={styles.tile}>
        <p className={styles.label}>Registered Users</p>
        <p className={styles.value}>{stats.registeredUsers}</p>
        <p className={styles.hint}>Active on Platform</p>
      </Card>

      <Card className={styles.tile}>
        <p className={styles.label}>Pending KYC Alerts</p>
        <p className={cn(styles.value, styles.dangerValue)}>{stats.pendingKycCount}</p>
        <p className={styles.hint}>Requires Manual Review</p>
      </Card>

      <Card className={styles.tile}>
        <p className={styles.label}>24K Spot Market Rate</p>
        <p className={styles.value}>{formatCurrency(stats.spotRatePerGramInr, 'INR')}/g</p>
        <p className={styles.hint}>Live Market Feed</p>
      </Card>
    </div>
  );
}

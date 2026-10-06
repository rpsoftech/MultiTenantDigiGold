import { Badge } from '@/components/common/Badge/Badge';
import { AdminStatsGrid } from '@/components/admin/AdminStatsGrid/AdminStatsGrid';
import styles from './TransactionStatsPanel.module.scss';

export function TransactionStatsPanel() {
  return (
    <section
      className={styles.panel}
      aria-labelledby="store-performance-heading"
    >
      <div className={styles.header}>
        <div>
          <h2 id="store-performance-heading" className={styles.title}>
            Store overview
          </h2>
          <p className={styles.subtitle}>
            Track your store’s gold volume, revenue, and earnings.
          </p>
        </div>
        <Badge variant="brand">All time</Badge>
      </div>
      <AdminStatsGrid />
    </section>
  );
}

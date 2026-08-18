'use client';

import { Card } from '@/components/common/Card/Card';
import { Badge } from '@/components/common/Badge/Badge';
import { Loader } from '@/components/common/Loader/Loader';
import { useRecentTransactions } from '@/features/admin/hooks/useRecentTransactions';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import {
  TRANSACTION_STATUS_BADGE_VARIANT,
  TRANSACTION_STATUS_LABEL,
} from '@/components/admin/adminStatusBadge';
import styles from './RecentTransactionsTable.module.scss';

export function RecentTransactionsTable() {
  const { data: transactions, isLoading } = useRecentTransactions();

  return (
    <section>
      <h2 className={styles.sectionTitle}>Recent Transactions</h2>

      <Card className={styles.tableCard}>
        {isLoading || !transactions ? (
          <Loader />
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>User</th>
                <th>Amount / Weight</th>
                <th>Type</th>
                <th>Status</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((txn) => (
                <tr key={txn.id}>
                  <td>
                    <span className={styles.userName}>{txn.userName}</span>
                    <span className={styles.userId}>{txn.userId}</span>
                  </td>
                  <td>
                    <span className={styles.amount}>{formatCurrency(txn.amountInr, 'INR')}</span>
                    <span className={styles.grams}>{txn.deltaGrams.toFixed(4)} g</span>
                  </td>
                  <td className={styles.typeCell}>{txn.type}</td>
                  <td>
                    <Badge variant={TRANSACTION_STATUS_BADGE_VARIANT[txn.status]}>
                      {TRANSACTION_STATUS_LABEL[txn.status]}
                    </Badge>
                  </td>
                  <td>{new Date(txn.timestamp).toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </section>
  );
}

'use client';

import { Card } from '@/components/common/Card/Card';
import { Badge } from '@/components/common/Badge/Badge';
import { Button } from '@/components/common/Button/Button';
import { Loader } from '@/components/common/Loader/Loader';
import { useAdminUsers } from '@/features/admin/hooks/useAdminUsers';
import { useUserTransactions } from '@/features/admin/hooks/useUserTransactions';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatMobileNumber } from '@/lib/utils/formatMobileNumber';
import styles from './TransactionLogPanel.module.scss';

export type TransactionLogPanelProps = {
  userId: string;
  onClose: () => void;
};

export function TransactionLogPanel({ userId, onClose }: TransactionLogPanelProps) {
  const { data: users } = useAdminUsers();
  const { data: transactions, isLoading } = useUserTransactions(userId);
  const user = users?.find((candidate) => candidate.userId === userId);

  const totalInvested =
    transactions?.reduce((sum, txn) => sum + txn.amountInr, 0) ?? 0;

  return (
    <Card className={styles.card}>
      <div className={styles.headerRow}>
        <div>
          <h2 className={styles.title}>Transaction History for {user?.name ?? userId}</h2>
          {user && (
            <p className={styles.subtitle}>
              Mobile: +91 {formatMobileNumber(user.mobileNumber)} | Total Invested:{' '}
              {formatCurrency(totalInvested, 'INR')}
            </p>
          )}
        </div>
        <Button variant="secondary" className={styles.closeButton} onClick={onClose}>
          Close Logs
        </Button>
      </div>

      {isLoading ? (
        <Loader />
      ) : transactions && transactions.length > 0 ? (
        <div className={styles.transactionList}>
          {transactions.map((txn) => (
            <div key={txn.id} className={styles.transactionRow}>
              <div>
                <span className={styles.txnId}>{txn.id}</span>
                <span className={styles.txnTime}>
                  {new Date(txn.timestamp).toLocaleString('en-IN')}
                </span>
              </div>
              <span className={styles.deltaGrams}>+{txn.deltaGrams.toFixed(4)} g</span>
              <span className={styles.amount}>{formatCurrency(txn.amountInr, 'INR')}</span>
              <Badge variant={txn.status === 'success' ? 'success' : 'danger'}>
                {txn.status}
              </Badge>
            </div>
          ))}
        </div>
      ) : (
        <p className={styles.emptyState}>No transactions recorded for this user yet.</p>
      )}
    </Card>
  );
}

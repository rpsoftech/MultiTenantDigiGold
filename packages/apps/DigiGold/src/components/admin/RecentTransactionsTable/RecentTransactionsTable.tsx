'use client';

import Link from 'next/link';
import { Card } from '@/components/common/Card/Card';
import { Button } from '@/components/common/Button/Button';
import { Loader } from '@/components/common/Loader/Loader';
import { StoreLedgerTable } from '@/components/admin/StoreLedgerTable/StoreLedgerTable';
import { useRecentTransactions } from '@/features/admin/hooks/useRecentTransactions';
import styles from './RecentTransactionsTable.module.scss';

export function RecentTransactionsTable() {
  const {
    data: transactions,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useRecentTransactions();

  return (
    <section
      className={styles.section}
      aria-labelledby="recent-transactions-title"
    >
      <div className={styles.header}>
        <div>
          <h2 className={styles.sectionTitle} id="recent-transactions-title">
            Recent transactions
          </h2>
          <p className={styles.description}>
            Latest activity across your store’s gold vaults.
          </p>
        </div>
        <Link className={styles.viewAll} href="/admin/ledger">
          View full ledger <span aria-hidden>→</span>
        </Link>
      </div>

      <Card className={styles.tableCard}>
        {isLoading ? (
          <div className={styles.state}>
            <Loader label="Loading recent transactions" />
          </div>
        ) : isError ? (
          <div className={styles.state} role="alert">
            <p>Couldn’t load recent transactions.</p>
            <Button
              variant="secondary"
              disabled={isFetching}
              onClick={() => void refetch()}
            >
              Try again
            </Button>
          </div>
        ) : !transactions?.length ? (
          <div className={styles.state}>
            <strong>No transactions yet</strong>
            <p>New store transactions will appear here.</p>
          </div>
        ) : (
          <>
            <StoreLedgerTable
              entries={transactions}
              caption="Recent store transactions"
            />
            <p className={styles.balanceNote}>
              Vault balances reflect each customer’s gold balance after the
              entry.
            </p>
          </>
        )}
      </Card>
    </section>
  );
}

'use client';

import { useState } from 'react';
import { Card } from '@/components/common/Card/Card';
import { Button } from '@/components/common/Button/Button';
import { Loader } from '@/components/common/Loader/Loader';
import { StoreLedgerTable } from '@/components/admin/StoreLedgerTable/StoreLedgerTable';
import { useStoreLedger } from '@/features/admin/hooks/useStoreLedger';
import styles from './StoreLedgerPanel.module.scss';

const PAGE_SIZE = 20;

export function StoreLedgerPanel() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, isFetching, refetch } = useStoreLedger(
    page,
    PAGE_SIZE,
  );
  const entries = data?.items ?? [];

  return (
    <section className={styles.section} aria-labelledby="store-ledger-title">
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Store activity</p>
          <h2 className={styles.title} id="store-ledger-title">
            Store ledger
          </h2>
          <p className={styles.description}>
            Purchases, redemptions and reversals, with the latest entries first.
          </p>
        </div>
        <Button
          variant="secondary"
          className={styles.action}
          disabled={isFetching}
          onClick={() => void refetch()}
        >
          {isFetching && !isLoading ? 'Refreshing…' : 'Refresh ledger'}
        </Button>
      </div>

      <Card className={styles.card}>
        <div className={styles.tableIntro}>
          <p>
            Vault balances show each customer’s gold balance immediately after
            that entry.
          </p>
          <span className={styles.legend}>
            + Gold credited <span aria-hidden>·</span> − Gold debited
          </span>
        </div>

        {isLoading ? (
          <div className={styles.state}>
            <Loader label="Loading store ledger" />
          </div>
        ) : isError ? (
          <div className={styles.state} role="alert">
            <h3>Couldn’t load the store ledger</h3>
            <p>Please try again to see your store’s transactions.</p>
            <Button
              variant="secondary"
              onClick={() => void refetch()}
              disabled={isFetching}
            >
              Try again
            </Button>
          </div>
        ) : entries.length === 0 ? (
          <div className={styles.state}>
            <h3>
              {page === 1
                ? 'No transactions yet'
                : 'You’ve reached the end of the ledger'}
            </h3>
            <p>
              {page === 1
                ? 'Store transactions will appear here as they are recorded.'
                : 'Return to the previous page to view your ledger entries.'}
            </p>
          </div>
        ) : (
          <StoreLedgerTable entries={entries} />
        )}

        <nav className={styles.pagination} aria-label="Ledger pagination">
          <p aria-live="polite">
            Page {page}
            {!isLoading && !isError && (
              <span>
                {' '}
                · {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
              </span>
            )}
          </p>
          <div className={styles.pageActions}>
            <Button
              variant="secondary"
              className={styles.action}
              disabled={page === 1 || isFetching}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              className={styles.action}
              disabled={!data?.hasNextPage || isFetching || isError}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </div>
        </nav>
      </Card>
    </section>
  );
}

'use client';

import { useState } from 'react';
import { Card } from '@/components/common/Card/Card';
import { Button } from '@/components/common/Button/Button';
import { Loader } from '@/components/common/Loader/Loader';
import { Modal } from '@/components/common/Modal/Modal';
import { useToast } from '@/components/common/Toast/Toast';
import { StoreLedgerTable } from '@/components/admin/StoreLedgerTable/StoreLedgerTable';
import { useStoreLedger } from '@/features/admin/hooks/useStoreLedger';
import { useReverseLedgerEntry } from '@/features/admin/hooks/useReverseLedgerEntry';
import type { AdminLedgerEntry } from '@/features/admin/admin.types';
import { describeApiError, isNormalizedApiError } from '@/lib/api/client';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import styles from './StoreLedgerPanel.module.scss';

const PAGE_SIZE = 20;

// MainServer answers 409 ERROR_LEDGER_REVERSAL (already reversed, not reversible, or a
// redemption no longer pending) and 404 ERROR_LEDGER_NOT_FOUND. Both mean our copy is stale.
const CONFLICT_FALLBACK = 'This entry can no longer be reversed.';

export function StoreLedgerPanel() {
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<AdminLedgerEntry | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const { showToast } = useToast();
  const reverse = useReverseLedgerEntry();
  const { data, isLoading, isError, isFetching, refetch } = useStoreLedger(
    page,
    PAGE_SIZE,
  );
  const entries = data?.items ?? [];

  function openReverse(entry: AdminLedgerEntry) {
    setDialogError(null);
    setTarget(entry);
  }

  function closeReverse(open: boolean) {
    // Keep the dialog up while the request is in flight so it cannot be dismissed mid-call.
    if (open || reverse.isPending) return;
    setTarget(null);
    setDialogError(null);
  }

  function confirmReverse() {
    if (!target || reverse.isPending) return;
    const entry = target;
    reverse.mutate(entry.id, {
      onSuccess: () => {
        setTarget(null);
        showToast({
          title: 'Entry reversed',
          description: `Ledger entry ${entry.id} was reversed.`,
          variant: 'success',
        });
      },
      onError: (error) => {
        const apiError = isNormalizedApiError(error) ? error : null;
        if (apiError?.status === 409 || apiError?.status === 404) {
          // Our copy is stale; the mutation already refetches the ledger.
          setTarget(null);
          const reason = (apiError.message || CONFLICT_FALLBACK).replace(/\.$/, '');
          showToast({
            title: 'Entry can’t be reversed',
            description: `${reason.charAt(0).toUpperCase()}${reason.slice(1)}. The ledger has been refreshed.`,
            variant: 'danger',
          });
          return;
        }
        setDialogError(
          describeApiError(error) ??
            'The entry could not be reversed. Please try again.',
        );
      },
    });
  }

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
          <StoreLedgerTable
            entries={entries}
            onReverse={openReverse}
            reversingId={reverse.isPending ? target?.id : null}
          />
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

      <Modal
        open={target !== null}
        onOpenChange={closeReverse}
        title="Reverse this ledger entry?"
        description="This posts an offsetting reversal entry and adjusts the customer’s vault balance. It cannot be undone."
      >
        {target && (
          <div className={styles.dialogBody}>
            <dl className={styles.summary}>
              <div>
                <dt>Entry</dt>
                <dd>{target.id}</dd>
              </div>
              <div>
                <dt>Amount</dt>
                <dd>{formatCurrency(target.amountInr, 'INR', 2)}</dd>
              </div>
              <div>
                <dt>Gold</dt>
                <dd>{target.weightGrams.toFixed(4)} g</dd>
              </div>
            </dl>
            {dialogError && (
              <p className={styles.dialogError} role="alert">
                {dialogError}
              </p>
            )}
            <div className={styles.dialogActions}>
              <Button
                variant="outlined"
                disabled={reverse.isPending}
                onClick={() => closeReverse(false)}
              >
                Cancel
              </Button>
              <Button isLoading={reverse.isPending} onClick={confirmReverse}>
                Reverse entry
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}

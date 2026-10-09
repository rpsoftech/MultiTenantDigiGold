'use client';

import { useRef, useState, type FormEvent } from 'react';
import { Card } from '@/components/common/Card/Card';
import { Button } from '@/components/common/Button/Button';
import { Input } from '@/components/common/Input/Input';
import { Loader } from '@/components/common/Loader/Loader';
import { Modal } from '@/components/common/Modal/Modal';
import { useToast } from '@/components/common/Toast/Toast';
import { CollectPickupDialog } from '@/components/admin/PendingPickupsPanel/CollectPickupDialog';
import { usePendingRedemptions } from '@/features/admin/hooks/usePendingRedemptions';
import { useCollectRedemption } from '@/features/admin/hooks/useCollectRedemption';
import { useCancelRedemption } from '@/features/admin/hooks/useCancelRedemption';
import type { PendingRedemption } from '@/features/admin/admin.types';
import { normalizePhoneSearch } from '@/features/admin/pickups.utils';
import { describeApiError, isNormalizedApiError } from '@/lib/api/client';
import { formatMobileNumber } from '@/lib/utils/formatMobileNumber';
import styles from './PendingPickupsPanel.module.scss';

const PAGE_SIZE = 20;

const WRONG_CODE_MESSAGE =
  'That pickup code is incorrect. Check it with the customer and try again.';

function formatRequested(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  });
}

function statusOf(error: unknown): number | null {
  return isNormalizedApiError(error) ? error.status : null;
}

function codeOf(error: unknown): string | null {
  return isNormalizedApiError(error) ? error.code : null;
}

export function PendingPickupsPanel() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [phone, setPhone] = useState('');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [collectTarget, setCollectTarget] = useState<PendingRedemption | null>(
    null,
  );
  const [code, setCode] = useState('');
  const [collectError, setCollectError] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<PendingRedemption | null>(
    null,
  );
  const [cancelError, setCancelError] = useState<string | null>(null);
  const codeInputRef = useRef<HTMLInputElement | null>(null);

  const { showToast } = useToast();
  const collect = useCollectRedemption();
  const cancel = useCancelRedemption();
  const { data, isLoading, isError, isFetching, refetch } =
    usePendingRedemptions(page, PAGE_SIZE, phone);
  const pickups = data?.items ?? [];

  function runSearch(event: FormEvent) {
    event.preventDefault();
    if (!searchInput.trim()) {
      clearSearch();
      return;
    }
    const normalized = normalizePhoneSearch(searchInput);
    if (!normalized) {
      setSearchError('Enter a 10-digit mobile number.');
      return;
    }
    setSearchError(null);
    setSearchInput(normalized);
    setPhone(normalized);
    setPage(1);
  }

  function clearSearch() {
    setSearchInput('');
    setSearchError(null);
    setPhone('');
    setPage(1);
  }

  function openCollect(pickup: PendingRedemption) {
    setCode('');
    setCollectError(null);
    setCollectTarget(pickup);
  }

  function closeCollect() {
    if (collect.isPending) return;
    setCollectTarget(null);
    setCode('');
    setCollectError(null);
  }

  // A 409/404 means the pickup was handled elsewhere (or removed): our list is stale and the
  // mutation is already refetching it, so drop the dialog and say why.
  function dismissStale(error: unknown) {
    setCollectTarget(null);
    setCancelTarget(null);
    setCode('');
    if (statusOf(error) === 404) {
      showToast({
        title: 'Pickup not found',
        description:
          'This request no longer exists. The list has been refreshed.',
        variant: 'danger',
      });
      return;
    }
    showToast({
      title: 'Already completed',
      description:
        'This pickup was already collected or cancelled. The list has been refreshed.',
      variant: 'danger',
    });
  }

  function confirmCollect() {
    if (!collectTarget || collect.isPending) return;
    const pickup = collectTarget;
    collect.mutate(
      { redemptionId: pickup.id, pickupCode: code },
      {
        onSuccess: () => {
          setCollectTarget(null);
          setCode('');
          showToast({
            title: 'Gold handed over',
            description: `${pickup.weightGrams.toFixed(4)} g collected by ${pickup.customerName}.`,
            variant: 'success',
          });
        },
        onError: (error) => {
          const status = statusOf(error);
          if (status === 409 || status === 404) {
            dismissStale(error);
            return;
          }
          if (codeOf(error) === 'INVALID_PICKUP_CODE') {
            // Clear the wrong code so the next attempt starts fresh, and put the cursor back.
            setCode('');
            setCollectError(WRONG_CODE_MESSAGE);
            requestAnimationFrame(() => codeInputRef.current?.focus());
            return;
          }
          setCollectError(
            describeApiError(error) ??
              'The pickup could not be completed. Please try again.',
          );
        },
      },
    );
  }

  function openCancel(pickup: PendingRedemption) {
    setCancelError(null);
    setCancelTarget(pickup);
  }

  function closeCancel(open: boolean) {
    if (open || cancel.isPending) return;
    setCancelTarget(null);
    setCancelError(null);
  }

  function confirmCancel() {
    if (!cancelTarget || cancel.isPending) return;
    const pickup = cancelTarget;
    cancel.mutate(pickup.id, {
      onSuccess: () => {
        setCancelTarget(null);
        showToast({
          title: 'Pickup cancelled',
          description: `${pickup.weightGrams.toFixed(4)} g returned to ${pickup.customerName}’s vault.`,
          variant: 'success',
        });
      },
      onError: (error) => {
        const status = statusOf(error);
        if (status === 409 || status === 404) {
          dismissStale(error);
          return;
        }
        setCancelError(
          describeApiError(error) ??
            'The pickup could not be cancelled. Please try again.',
        );
      },
    });
  }

  const busyId = cancel.isPending ? cancelTarget?.id : null;
  const firstItem = (page - 1) * PAGE_SIZE + 1;

  return (
    <section aria-labelledby="pickups-title">
      <div className={styles.sectionHeader}>
        <div>
          <h2 id="pickups-title" className={styles.sectionTitle}>
            Pending pickups
          </h2>
          <p className={styles.sectionDescription}>
            Customers waiting to collect physical gold at the counter, oldest
            first. Collect with the customer’s pickup code.
          </p>
        </div>
        <Button
          variant="secondary"
          className={styles.action}
          disabled={isFetching}
          onClick={() => void refetch()}
        >
          {isFetching && !isLoading ? 'Refreshing…' : 'Refresh pickups'}
        </Button>
      </div>

      <form className={styles.search} onSubmit={runSearch} noValidate>
        <Input
          id="pickup-phone-search"
          name="pickup-phone-search"
          label="Search by customer mobile"
          placeholder="98765 43210"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          leftAddon="+91"
          value={searchInput}
          error={searchError ?? undefined}
          onChange={(event) => {
            setSearchInput(event.target.value);
            if (searchError) setSearchError(null);
          }}
        />
        <div className={styles.searchActions}>
          <Button type="submit" disabled={isFetching && Boolean(phone)}>
            Search
          </Button>
          {(phone || searchInput) && (
            <Button type="button" variant="outlined" onClick={clearSearch}>
              Clear
            </Button>
          )}
        </div>
      </form>

      <Card className={styles.tableCard}>
        {isLoading ? (
          <div className={styles.state}>
            <Loader label="Loading pending pickups" />
            <p>Loading pending pickups…</p>
          </div>
        ) : isError ? (
          <div className={styles.state} role="alert">
            <strong>Pending pickups are unavailable</strong>
            <p>We couldn’t load the pickups. Please try again.</p>
            <Button
              variant="secondary"
              onClick={() => void refetch()}
              isLoading={isFetching}
            >
              Try again
            </Button>
          </div>
        ) : pickups.length === 0 ? (
          <div className={styles.state}>
            <strong>
              {phone
                ? `No pending pickups for +91 ${formatMobileNumber(phone)}`
                : page === 1
                  ? 'No pending pickups'
                  : 'No pickups on this page'}
            </strong>
            <p>
              {phone
                ? 'This customer has nothing waiting at the counter, or the number is not registered with this store.'
                : page === 1
                  ? 'Requests to collect physical gold will appear here.'
                  : 'Go to the previous page to see more pickups.'}
            </p>
            {phone && (
              <Button variant="outlined" onClick={clearSearch}>
                Show all pickups
              </Button>
            )}
          </div>
        ) : (
          <div className={styles.tableScroll} aria-busy={isFetching}>
            <table className={styles.table} aria-label="Pending pickups">
              <thead>
                <tr>
                  <th scope="col">Customer</th>
                  <th scope="col">Mobile</th>
                  <th scope="col">Gold</th>
                  <th scope="col">Requested (IST)</th>
                  <th scope="col">
                    <span className={styles.visuallyHidden}>Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pickups.map((pickup) => (
                  <tr key={pickup.id}>
                    <td data-label="Customer">
                      <div>
                        <span className={styles.userName}>
                          {pickup.customerName}
                        </span>
                        <span className={styles.userId}>{pickup.id}</span>
                      </div>
                    </td>
                    <td data-label="Mobile">
                      +91 {formatMobileNumber(pickup.customerPhone)}
                    </td>
                    <td className={styles.goldBalance} data-label="Gold">
                      {pickup.weightGrams.toFixed(4)} g
                    </td>
                    <td className={styles.joinedDate} data-label="Requested (IST)">
                      <time dateTime={pickup.requestedAt}>
                        {formatRequested(pickup.requestedAt)}
                      </time>
                    </td>
                    <td className={styles.actionsCell}>
                      <div className={styles.actions}>
                        <Button
                          className={styles.reviewButton}
                          aria-label={`Collect pickup for ${pickup.customerName}`}
                          disabled={cancel.isPending}
                          onClick={() => openCollect(pickup)}
                        >
                          Collect
                        </Button>
                        <Button
                          variant="outlined"
                          className={styles.reviewButton}
                          aria-label={`Cancel pickup for ${pickup.customerName}`}
                          disabled={cancel.isPending || collect.isPending}
                          isLoading={busyId === pickup.id}
                          onClick={() => openCancel(pickup)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <nav className={styles.pagination} aria-label="Pickups pagination">
          <span className={styles.pageSummary} aria-live="polite">
            {isFetching
              ? 'Loading pickups…'
              : isError
                ? `Page ${page}`
                : pickups.length
                  ? `Showing ${firstItem}–${firstItem + pickups.length - 1} pickups`
                  : '0 pickups on this page'}
          </span>
          <div className={styles.pageControls}>
            <Button
              variant="secondary"
              className={styles.action}
              disabled={page === 1 || isFetching}
              onClick={() => setPage((current) => current - 1)}
            >
              Previous
            </Button>
            <span className={styles.pageNumber}>Page {page}</span>
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

      <CollectPickupDialog
        redemption={collectTarget}
        code={code}
        onCodeChange={(next) => {
          setCode(next);
          if (collectError) setCollectError(null);
        }}
        isPending={collect.isPending}
        error={collectError}
        inputRef={codeInputRef}
        onSubmit={confirmCollect}
        onClose={closeCollect}
      />

      <Modal
        open={cancelTarget !== null}
        onOpenChange={closeCancel}
        title="Cancel this pickup?"
        description="The gold goes back to the customer’s vault and the pickup code stops working. This cannot be undone."
      >
        {cancelTarget && (
          <div className={styles.dialogBody}>
            <dl className={styles.summary}>
              <div>
                <dt>Customer</dt>
                <dd>{cancelTarget.customerName}</dd>
              </div>
              <div>
                <dt>Gold returned</dt>
                <dd>{cancelTarget.weightGrams.toFixed(4)} g</dd>
              </div>
            </dl>
            {cancelError && (
              <p className={styles.dialogError} role="alert">
                {cancelError}
              </p>
            )}
            <div className={styles.dialogActions}>
              <Button
                variant="outlined"
                disabled={cancel.isPending}
                onClick={() => closeCancel(false)}
              >
                Keep pickup
              </Button>
              <Button
                isLoading={cancel.isPending}
                aria-label="Cancel pickup"
                onClick={confirmCancel}
              >
                Cancel pickup
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}

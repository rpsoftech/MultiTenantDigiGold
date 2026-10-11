'use client';

import { useRef, useState, type FormEvent } from 'react';
import { Badge } from '@/components/common/Badge/Badge';
import { Button } from '@/components/common/Button/Button';
import { Input } from '@/components/common/Input/Input';
import { Modal } from '@/components/common/Modal/Modal';
import { useToast } from '@/components/common/Toast/Toast';
import { CollectPickupDialog } from '@/components/admin/PendingPickupsPanel/CollectPickupDialog';
import {
  PagedTable,
  pagedTableStyles,
  type PagedTableText,
} from '@/components/admin/PagedTable/PagedTable';
import { usePendingRedemptions } from '@/features/admin/hooks/usePendingRedemptions';
import { useCollectRedemption } from '@/features/admin/hooks/useCollectRedemption';
import { useCancelRedemption } from '@/features/admin/hooks/useCancelRedemption';
import type { PendingRedemption } from '@/features/admin/admin.types';
import {
  MAX_PICKUP_CODE_ATTEMPTS,
  normalizePhoneSearch,
} from '@/features/admin/pickups.utils';
import { describeApiError, isNormalizedApiError } from '@/lib/api/client';
import { formatMobileNumber } from '@/lib/utils/formatMobileNumber';
import styles from './PendingPickupsPanel.module.scss';

const PAGE_SIZE = 20;

const WRONG_CODE_MESSAGE =
  'That pickup code is incorrect. Check it with the customer and try again.';

const TEXT: PagedTableText = {
  loadingLabel: 'Loading pending pickups',
  loadingDetail: 'Loading pending pickups…',
  errorTitle: 'Pending pickups are unavailable',
  errorDetail: 'We couldn’t load the pickups. Please try again.',
  emptyTitle: 'No pending pickups',
  emptyDetail: 'Requests to collect physical gold will appear here.',
  emptyPageTitle: 'No pickups on this page',
  emptyPageDetail: 'Go to the previous page to see more pickups.',
  noun: 'pickups',
  paginationLabel: 'Pickups pagination',
};

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

function triesLeft(count: number) {
  return `${count} ${count === 1 ? 'try' : 'tries'} left`;
}

function asApiError(error: unknown) {
  return isNormalizedApiError(error) ? error : null;
}

// MainServer reports the tries left before the pickup locks in `extra.attempts_left`.
function attemptsLeftOf(error: unknown): number | null {
  const extra = asApiError(error)?.extra as
    | { attempts_left?: unknown }
    | undefined;
  return typeof extra?.attempts_left === 'number' ? extra.attempts_left : null;
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
    if (asApiError(error)?.status === 404) {
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
          const apiError = asApiError(error);
          // Too many wrong codes: only cancelling (gold back to the vault) is left.
          if (apiError?.code === 'PICKUP_CODE_LOCKED') {
            setCollectTarget(null);
            setCode('');
            showToast({
              title: 'Pickup locked',
              description: `Too many wrong codes were entered for ${pickup.customerName}’s pickup. Cancel it to return the gold to their vault; they can then request a new pickup.`,
              variant: 'danger',
            });
            return;
          }
          if (apiError?.status === 409 || apiError?.status === 404) {
            dismissStale(error);
            return;
          }
          if (apiError?.code === 'INVALID_PICKUP_CODE') {
            // Clear the wrong code so the next attempt starts fresh, and put the cursor back.
            const left = attemptsLeftOf(error);
            setCode('');
            setCollectError(
              left === null
                ? WRONG_CODE_MESSAGE
                : `${WRONG_CODE_MESSAGE} ${triesLeft(left)} before this pickup is locked.`,
            );
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
        const status = asApiError(error)?.status;
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

  return (
    <>
      <PagedTable
        titleId="pickups-title"
        title="Pending pickups"
        description="Customers waiting to collect physical gold at the counter, oldest first. Collect with the customer’s pickup code."
        text={TEXT}
        page={page}
        limit={PAGE_SIZE}
        onPageChange={setPage}
        itemCount={pickups.length}
        hasNextPage={data?.hasNextPage ?? false}
        isLoading={isLoading}
        isError={isError}
        isFetching={isFetching}
        onRetry={() => void refetch()}
        tableLabel="Pending pickups"
        minWidth={760}
        actions={
          <Button
            variant="secondary"
            className={styles.action}
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            {isFetching && !isLoading ? 'Refreshing…' : 'Refresh pickups'}
          </Button>
        }
        toolbar={
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
        }
        emptyState={
          phone ? (
            <div className={pagedTableStyles.state}>
              <strong>
                No pending pickups for +91 {formatMobileNumber(phone)}
              </strong>
              <p>
                This customer has nothing waiting at the counter, or the number
                is not registered with this store.
              </p>
              <Button variant="outlined" onClick={clearSearch}>
                Show all pickups
              </Button>
            </div>
          ) : undefined
        }
      >
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
          {pickups.map((pickup) => {
            const locked = pickup.codeAttemptsLeft <= 0;
            return (
              <tr key={pickup.id}>
                <td data-label="Customer">
                  <div>
                    <span className={pagedTableStyles.userName}>
                      {pickup.customerName}
                    </span>
                    <span className={pagedTableStyles.userId}>{pickup.id}</span>
                    {locked ? (
                      <Badge variant="danger">
                        Locked: too many wrong codes
                      </Badge>
                    ) : (
                      pickup.codeAttemptsLeft < MAX_PICKUP_CODE_ATTEMPTS && (
                        <span className={pagedTableStyles.userId}>
                          {triesLeft(pickup.codeAttemptsLeft)} for the code
                        </span>
                      )
                    )}
                  </div>
                </td>
                <td data-label="Mobile">
                  +91 {formatMobileNumber(pickup.customerPhone)}
                </td>
                <td className={pagedTableStyles.goldBalance} data-label="Gold">
                  {pickup.weightGrams.toFixed(4)} g
                </td>
                <td
                  className={pagedTableStyles.dateCell}
                  data-label="Requested (IST)"
                >
                  <time dateTime={pickup.requestedAt}>
                    {formatRequested(pickup.requestedAt)}
                  </time>
                </td>
                <td className={styles.actionsCell}>
                  <div className={styles.actions}>
                    <Button
                      className={styles.reviewButton}
                      aria-label={`Collect pickup for ${pickup.customerName}`}
                      title={
                        locked
                          ? 'Locked after too many wrong codes. Cancel it instead.'
                          : undefined
                      }
                      disabled={cancel.isPending || locked}
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
            );
          })}
        </tbody>
      </PagedTable>

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
    </>
  );
}

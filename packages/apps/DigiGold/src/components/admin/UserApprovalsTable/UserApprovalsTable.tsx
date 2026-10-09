'use client';

import { useState } from 'react';
import { Card } from '@/components/common/Card/Card';
import { Button } from '@/components/common/Button/Button';
import { Loader } from '@/components/common/Loader/Loader';
import { useToast } from '@/components/common/Toast/Toast';
import { KycReviewDialog } from '@/components/admin/KycReviewDialog/KycReviewDialog';
import { usePendingKyc } from '@/features/admin/hooks/usePendingKyc';
import { useUpdateKycStatus } from '@/features/admin/hooks/useUpdateKycStatus';
import type {
  PendingKycSubmission,
  UpdateKycStatusPayload,
} from '@/features/admin/admin.types';
import { describeApiError, isNormalizedApiError } from '@/lib/api/client';
import { formatMobileNumber } from '@/lib/utils/formatMobileNumber';
import styles from './UserApprovalsTable.module.scss';

type Decision = UpdateKycStatusPayload['kycStatus'];

const DECISION_TOAST: Record<Decision, string> = {
  verified: 'KYC approved',
  rejected: 'KYC rejected',
};

export function UserApprovalsTable() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [target, setTarget] = useState<PendingKycSubmission | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const { showToast } = useToast();
  const updateKycStatus = useUpdateKycStatus();
  const { data, isLoading, isError, isFetching, refetch } = usePendingKyc(
    page,
    limit,
  );
  const submissions = data?.items ?? [];
  const firstItem = (page - 1) * limit + 1;

  function openReview(submission: PendingKycSubmission) {
    setDialogError(null);
    setTarget(submission);
  }

  function closeReview() {
    // The dialog also refuses to close mid-request; this guards the other entry points.
    if (updateKycStatus.isPending) return;
    setTarget(null);
    setDialogError(null);
  }

  function decide(kycStatus: Decision) {
    if (!target || updateKycStatus.isPending) return;
    const submission = target;
    updateKycStatus.mutate(
      { userId: submission.userId, kycStatus },
      {
        onSuccess: () => {
          setTarget(null);
          showToast({
            title: DECISION_TOAST[kycStatus],
            description: `${submission.name}’s KYC was ${kycStatus === 'verified' ? 'approved' : 'rejected'}.`,
            variant: 'success',
          });
        },
        onError: (error) => {
          const status = isNormalizedApiError(error) ? error.status : null;
          if (status === 403 || status === 404) {
            // Not in this store any more: our copy is stale and the queue is refetching.
            setTarget(null);
            showToast({
              title: 'Customer unavailable',
              description:
                'This customer is no longer in your store. The queue has been refreshed.',
              variant: 'danger',
            });
            return;
          }
          setDialogError(
            describeApiError(error) ??
              'The decision could not be saved. Please try again.',
          );
        },
      },
    );
  }

  const pendingDecision = updateKycStatus.isPending
    ? (updateKycStatus.variables?.kycStatus ?? null)
    : null;

  return (
    <section aria-labelledby="kyc-review-title">
      <div className={styles.sectionHeader}>
        <div>
          <h2 id="kyc-review-title" className={styles.sectionTitle}>
            KYC review
          </h2>
          <p className={styles.sectionDescription}>
            Customers who have submitted KYC details and are waiting for a
            decision, oldest first.
          </p>
        </div>
        <label className={styles.pageSize}>
          Rows per page
          <select
            value={limit}
            disabled={isFetching}
            onChange={(event) => {
              setLimit(Number(event.target.value));
              setPage(1);
            }}
          >
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>
      </div>

      <Card className={styles.tableCard}>
        {isLoading ? (
          <div className={styles.state}>
            <Loader label="Loading KYC submissions" />
            <p>Loading KYC submissions…</p>
          </div>
        ) : isError ? (
          <div className={styles.state} role="alert">
            <strong>KYC queue is unavailable</strong>
            <p>We couldn’t load the pending submissions. Please try again.</p>
            <Button
              variant="outlined"
              onClick={() => refetch()}
              isLoading={isFetching}
            >
              Try again
            </Button>
          </div>
        ) : submissions.length === 0 ? (
          <div className={styles.state}>
            <strong>
              {page === 1
                ? 'No KYC submissions waiting'
                : 'No submissions on this page'}
            </strong>
            <p>
              {page === 1
                ? 'New KYC submissions will appear here for review.'
                : 'Go to the previous page to see more submissions.'}
            </p>
          </div>
        ) : (
          <div className={styles.tableScroll} aria-busy={isFetching}>
            <table className={styles.table} aria-label="Pending KYC submissions">
              <thead>
                <tr>
                  <th scope="col">Customer</th>
                  <th scope="col">Contact</th>
                  <th scope="col">Vault balance</th>
                  <th scope="col">
                    <span className={styles.visuallyHidden}>Review</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((submission) => (
                  <tr key={submission.userId}>
                    <td data-label="Customer">
                      <div>
                        <span className={styles.userName}>
                          {submission.name}
                        </span>
                        <span className={styles.userId}>
                          {submission.userId}
                        </span>
                      </div>
                    </td>
                    <td data-label="Contact">
                      <div className={styles.contact}>
                        <span>
                          {submission.mobileNumber
                            ? `+91 ${formatMobileNumber(submission.mobileNumber)}`
                            : '—'}
                        </span>
                        {submission.email && (
                          <span className={styles.email}>
                            {submission.email}
                          </span>
                        )}
                      </div>
                    </td>
                    <td
                      className={styles.goldBalance}
                      data-label="Vault balance"
                    >
                      {submission.goldBalanceGrams.toFixed(4)} g
                    </td>
                    <td className={styles.actionsCell}>
                      <Button
                        className={styles.reviewButton}
                        aria-label={`Review KYC for ${submission.name}`}
                        onClick={() => openReview(submission)}
                      >
                        Review
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <nav className={styles.pagination} aria-label="KYC pagination">
          <span className={styles.pageSummary} aria-live="polite">
            {isFetching
              ? 'Loading submissions…'
              : isError
                ? `Page ${page}`
                : submissions.length
                  ? `Showing ${firstItem}–${firstItem + submissions.length - 1} submissions`
                  : '0 submissions on this page'}
          </span>
          <div className={styles.pageControls}>
            <Button
              variant="outlined"
              className={styles.pageButton}
              disabled={page === 1 || isFetching}
              onClick={() => setPage((current) => current - 1)}
            >
              Previous
            </Button>
            <span className={styles.pageNumber}>Page {page}</span>
            <Button
              variant="outlined"
              className={styles.pageButton}
              disabled={!data?.hasNextPage || isFetching || isError}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </div>
        </nav>
      </Card>

      <KycReviewDialog
        key={target?.userId ?? 'closed'}
        submission={target}
        pendingDecision={pendingDecision}
        error={dialogError}
        onDecide={decide}
        onClose={closeReview}
      />
    </section>
  );
}

'use client';

import { useState } from 'react';
import { Button } from '@/components/common/Button/Button';
import { useToast } from '@/components/common/Toast/Toast';
import { KycReviewDialog } from '@/components/admin/KycReviewDialog/KycReviewDialog';
import {
  PagedTable,
  pagedTableStyles,
  type PagedTableText,
} from '@/components/admin/PagedTable/PagedTable';
import { usePendingKyc } from '@/features/admin/hooks/usePendingKyc';
import { useUpdateKycStatus } from '@/features/admin/hooks/useUpdateKycStatus';
import type {
  PendingKycSubmission,
  UpdateKycStatusPayload,
} from '@/features/admin/admin.types';
import { describeApiError, isNormalizedApiError } from '@/lib/api/client';
import { formatMobileNumber } from '@/lib/utils/formatMobileNumber';
import styles from './KycReviewQueue.module.scss';

type Decision = UpdateKycStatusPayload['kycStatus'];

const DECISION_TOAST: Record<Decision, string> = {
  verified: 'KYC approved',
  rejected: 'KYC rejected',
};

const TEXT: PagedTableText = {
  loadingLabel: 'Loading KYC submissions',
  loadingDetail: 'Loading KYC submissions…',
  errorTitle: 'KYC queue is unavailable',
  errorDetail: 'We couldn’t load the pending submissions. Please try again.',
  emptyTitle: 'No KYC submissions waiting',
  emptyDetail: 'New KYC submissions will appear here for review.',
  emptyPageTitle: 'No submissions on this page',
  emptyPageDetail: 'Go to the previous page to see more submissions.',
  noun: 'submissions',
  paginationLabel: 'KYC pagination',
};

function submittedOn(value?: string) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
      })
    : '—';
}

export function KycReviewQueue() {
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

  // Our copy of the queue is stale; the mutation is already refetching it.
  function staleSubmission(title: string, description: string) {
    setTarget(null);
    showToast({ title, description, variant: 'danger' });
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
          const apiError = isNormalizedApiError(error) ? error : null;
          if (apiError?.code === 'KYC_NOT_AWAITING_REVIEW') {
            staleSubmission(
              'Already decided',
              `${submission.name}’s KYC is no longer waiting for review; another admin may have decided it. The queue has been refreshed.`,
            );
            return;
          }
          if (apiError?.status === 403 || apiError?.status === 404) {
            staleSubmission(
              'Customer unavailable',
              'This customer is no longer in your store. The queue has been refreshed.',
            );
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
    <>
      <PagedTable
        titleId="kyc-review-title"
        title="KYC review"
        description="Customers who have submitted KYC details and are waiting for a decision, oldest submission first."
        text={TEXT}
        page={page}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
        itemCount={submissions.length}
        hasNextPage={data?.hasNextPage ?? false}
        isLoading={isLoading}
        isError={isError}
        isFetching={isFetching}
        onRetry={() => void refetch()}
        tableLabel="Pending KYC submissions"
        minWidth={720}
      >
        <thead>
          <tr>
            <th scope="col">Customer</th>
            <th scope="col">Contact</th>
            <th scope="col">Submitted</th>
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
                  <span className={pagedTableStyles.userName}>
                    {submission.name}
                  </span>
                  <span className={pagedTableStyles.userId}>
                    {submission.userId}
                  </span>
                </div>
              </td>
              <td data-label="Contact">
                <div className={pagedTableStyles.contact}>
                  <span>
                    {submission.mobileNumber
                      ? `+91 ${formatMobileNumber(submission.mobileNumber)}`
                      : '—'}
                  </span>
                  {submission.email && (
                    <span className={pagedTableStyles.email}>
                      {submission.email}
                    </span>
                  )}
                </div>
              </td>
              <td className={pagedTableStyles.dateCell} data-label="Submitted">
                {submittedOn(submission.submittedAt)}
              </td>
              <td
                className={pagedTableStyles.goldBalance}
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
      </PagedTable>

      <KycReviewDialog
        key={target?.userId ?? 'closed'}
        submission={target}
        pendingDecision={pendingDecision}
        error={dialogError}
        onDecide={decide}
        onClose={closeReview}
      />
    </>
  );
}

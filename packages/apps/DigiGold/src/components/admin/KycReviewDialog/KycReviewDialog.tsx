'use client';

import { useState } from 'react';
import { Button } from '@/components/common/Button/Button';
import { Modal } from '@/components/common/Modal/Modal';
import type {
  PendingKycSubmission,
  UpdateKycStatusPayload,
} from '@/features/admin/admin.types';
import { formatMobileNumber } from '@/lib/utils/formatMobileNumber';
import styles from './KycReviewDialog.module.scss';

type Decision = UpdateKycStatusPayload['kycStatus'];

// Mount with key={userId} so every review starts on the details step.
export type KycReviewDialogProps = {
  submission: PendingKycSubmission | null;
  // The decision being sent, if any. The dialog cannot be dismissed while it is set.
  pendingDecision: Decision | null;
  error: string | null;
  onDecide: (decision: Decision) => void;
  onClose: () => void;
};

const CONFIRM_COPY: Record<
  Decision,
  { title: string; text: string; action: string }
> = {
  verified: {
    title: 'Approve this KYC?',
    text: 'The customer will be marked as verified and can make KYC-gated purchases right away.',
    action: 'Confirm approval',
  },
  rejected: {
    title: 'Reject this KYC?',
    text: 'The customer will be marked as rejected and will need to submit their details again. They are not told why.',
    action: 'Confirm rejection',
  },
};

function maskedAadhaar(last4?: string) {
  return last4 ? `XXXX XXXX ${last4}` : undefined;
}

function Detail({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value || <span className={styles.missing}>Not provided</span>}</dd>
    </div>
  );
}

export function KycReviewDialog({
  submission,
  pendingDecision,
  error,
  onDecide,
  onClose,
}: KycReviewDialogProps) {
  const [confirming, setConfirming] = useState<Decision | null>(null);
  const busy = pendingDecision !== null;

  function handleOpenChange(open: boolean) {
    if (open || busy) return;
    onClose();
  }

  const confirmCopy = confirming ? CONFIRM_COPY[confirming] : null;

  return (
    <Modal
      open={submission !== null}
      onOpenChange={handleOpenChange}
      title={confirmCopy?.title ?? 'Review KYC submission'}
      description={
        confirmCopy
          ? undefined
          : 'Check the submitted details, then approve or reject.'
      }
    >
      {submission && (
        <div className={styles.body}>
          <dl className={styles.details} aria-label="Customer">
            <Detail label="Customer" value={submission.name} />
            <Detail
              label="Mobile"
              value={
                submission.mobileNumber
                  ? `+91 ${formatMobileNumber(submission.mobileNumber)}`
                  : undefined
              }
            />
            <Detail label="Email" value={submission.email} />
            <Detail label="City" value={submission.city} />
          </dl>

          <p className={styles.sectionLabel}>Submitted documents</p>
          <dl className={styles.details} aria-label="Submitted documents">
            <Detail label="PAN" value={submission.documents.panNumber} />
            <Detail
              label="Aadhaar"
              value={maskedAadhaar(submission.documents.aadhaarLast4)}
            />
            {submission.documents.other.map((field) => (
              <Detail
                key={field.label}
                label={field.label}
                value={field.value}
              />
            ))}
          </dl>

          {confirmCopy && <p className={styles.confirmText}>{confirmCopy.text}</p>}
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          <div className={styles.actions}>
            {confirming ? (
              <>
                <Button
                  variant="outlined"
                  disabled={busy}
                  onClick={() => setConfirming(null)}
                >
                  Back
                </Button>
                <Button
                  isLoading={busy}
                  aria-label={CONFIRM_COPY[confirming].action}
                  onClick={() => onDecide(confirming)}
                >
                  {CONFIRM_COPY[confirming].action}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outlined" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => setConfirming('rejected')}
                >
                  Reject
                </Button>
                <Button onClick={() => setConfirming('verified')}>
                  Approve
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

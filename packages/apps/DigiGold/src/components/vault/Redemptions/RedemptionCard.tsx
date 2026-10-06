'use client';

import { useState } from 'react';
import { Badge } from '@/components/common/Badge/Badge';
import { Button } from '@/components/common/Button/Button';
import { Loader } from '@/components/common/Loader/Loader';
import { Modal } from '@/components/common/Modal/Modal';
import { useToast } from '@/components/common/Toast/Toast';
import { useCancelRedemption } from '@/features/redemption/hooks/useCancelRedemption';
import {
  REDEMPTION_STATUS_LABELS,
  REDEMPTION_STATUS_VARIANTS,
  formatGrams,
} from '@/features/redemption/redemption.utils';
import type { Redemption } from '@/features/redemption/redemption.types';
import { describeApiError, isNormalizedApiError } from '@/lib/api/client';
import { PickupCodeCard } from './PickupCodeCard';
import styles from './RedemptionCard.module.scss';

function formatDate(isoTimestamp: string): string {
  return new Date(isoTimestamp).toLocaleString('en-IN');
}

export function RedemptionCard({ redemption }: { redemption: Redemption }) {
  const { showToast } = useToast();
  const cancelRedemption = useCancelRedemption();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const isPending = redemption.status === 'PENDING';

  const handleCancel = async () => {
    try {
      await cancelRedemption.mutateAsync(redemption.redemption_uuid);
      setIsConfirmOpen(false);
      showToast({
        variant: 'success',
        title: 'Redemption cancelled',
        description: 'The gold is back in your vault.',
      });
    } catch (error) {
      setIsConfirmOpen(false);
      const notPending = isNormalizedApiError(error) && error.code === 'REDEMPTION_NOT_PENDING';
      showToast({
        variant: 'danger',
        title: notPending
          ? 'This redemption can no longer be cancelled'
          : 'Could not cancel redemption',
        description: describeApiError(error) ?? 'Please try again in a moment.',
      });
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <Badge variant={REDEMPTION_STATUS_VARIANTS[redemption.status]}>
          {REDEMPTION_STATUS_LABELS[redemption.status] ?? redemption.status}
        </Badge>
        <span className={styles.date}>{formatDate(redemption.created_at)}</span>
      </div>

      <div className={styles.detailGrid}>
        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>Weight</span>
          <span className={styles.detailValueBrand}>
            {formatGrams(redemption.weight_grams)}
          </span>
        </div>
        {redemption.collected_at && (
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Collected on</span>
            <span className={styles.detailValue}>
              {formatDate(redemption.collected_at)}
            </span>
          </div>
        )}
        {redemption.cancelled_at && (
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Cancelled on</span>
            <span className={styles.detailValue}>
              {formatDate(redemption.cancelled_at)}
            </span>
          </div>
        )}
      </div>

      {isPending && redemption.pickup_code && (
        <PickupCodeCard code={redemption.pickup_code} compact />
      )}

      {isPending && (
        <button
          type="button"
          className={styles.dangerButton}
          onClick={() => setIsConfirmOpen(true)}
        >
          Cancel redemption
        </button>
      )}

      <Modal
        open={isConfirmOpen}
        onOpenChange={(open) => {
          if (!cancelRedemption.isPending) setIsConfirmOpen(open);
        }}
        title="Cancel this redemption?"
        description={`${formatGrams(redemption.weight_grams)} will go back to your vault and the pickup code stops working.`}
      >
        {cancelRedemption.isPending ? (
          <div className={styles.modalLoader}>
            <Loader label="Cancelling redemption" />
          </div>
        ) : (
          <div className={styles.modalActions}>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsConfirmOpen(false)}
            >
              Keep it
            </Button>
            <button
              type="button"
              className={styles.dangerButton}
              onClick={() => void handleCancel()}
            >
              Yes, cancel
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}

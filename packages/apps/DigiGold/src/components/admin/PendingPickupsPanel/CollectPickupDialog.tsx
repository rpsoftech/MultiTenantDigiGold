'use client';

import type { FormEvent, RefObject } from 'react';
import { Button } from '@/components/common/Button/Button';
import { Input } from '@/components/common/Input/Input';
import { Modal } from '@/components/common/Modal/Modal';
import type { PendingRedemption } from '@/features/admin/admin.types';
import {
  PICKUP_CODE_LENGTH,
  isValidPickupCode,
  sanitizePickupCode,
} from '@/features/admin/pickups.utils';
import { formatMobileNumber } from '@/lib/utils/formatMobileNumber';
import styles from './PendingPickupsPanel.module.scss';

export type CollectPickupDialogProps = {
  redemption: PendingRedemption | null;
  code: string;
  onCodeChange: (code: string) => void;
  isPending: boolean;
  error: string | null;
  inputRef: RefObject<HTMLInputElement | null>;
  onSubmit: () => void;
  onClose: () => void;
};

export function CollectPickupDialog({
  redemption,
  code,
  onCodeChange,
  isPending,
  error,
  inputRef,
  onSubmit,
  onClose,
}: CollectPickupDialogProps) {
  const canSubmit = isValidPickupCode(code) && !isPending;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (canSubmit) onSubmit();
  }

  return (
    <Modal
      open={redemption !== null}
      // Keep the dialog up while the request is in flight so it cannot be dismissed mid-call.
      onOpenChange={(open) => {
        if (!open && !isPending) onClose();
      }}
      title="Hand over gold"
      description="Ask the customer for the 6-digit pickup code shown in their app. Hand over the gold only after the code is accepted."
    >
      {redemption && (
        <form className={styles.dialogBody} onSubmit={handleSubmit} noValidate>
          <dl className={styles.summary}>
            <div>
              <dt>Customer</dt>
              <dd>{redemption.customerName}</dd>
            </div>
            <div>
              <dt>Mobile</dt>
              <dd>+91 {formatMobileNumber(redemption.customerPhone)}</dd>
            </div>
            <div>
              <dt>Gold to hand over</dt>
              <dd>{redemption.weightGrams.toFixed(4)} g</dd>
            </div>
          </dl>

          <Input
            ref={inputRef}
            id="pickup-code"
            name="pickup-code"
            label="Pickup code"
            placeholder="6-digit code"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            maxLength={PICKUP_CODE_LENGTH + 2}
            value={code}
            disabled={isPending}
            error={error ?? undefined}
            onChange={(event) =>
              onCodeChange(sanitizePickupCode(event.target.value))
            }
          />

          <div className={styles.dialogActions}>
            <Button
              type="button"
              variant="outlined"
              disabled={isPending}
              onClick={onClose}
            >
              Back
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit}
              isLoading={isPending}
              aria-label="Confirm handover"
            >
              Confirm handover
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

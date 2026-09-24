import type { BadgeVariant } from '@/components/common/Badge/Badge';
import type { AdminTransactionStatus } from '@/features/admin/admin.types';
import type { KycStatus } from '@/store/session/session.types';

export const KYC_BADGE_VARIANT: Record<KycStatus, BadgeVariant> = {
  verified: 'success',
  pending: 'neutral',
  rejected: 'danger',
  not_started: 'neutral',
};

export const KYC_LABEL: Record<KycStatus, string> = {
  verified: 'Approved',
  pending: 'Pending',
  rejected: 'Rejected',
  not_started: 'Not Started',
};

export const TRANSACTION_STATUS_BADGE_VARIANT: Record<AdminTransactionStatus, BadgeVariant> = {
  success: 'success',
  pending: 'neutral',
  failed: 'danger',
};

export const TRANSACTION_STATUS_LABEL: Record<AdminTransactionStatus, string> = {
  success: 'Success',
  pending: 'Pending',
  failed: 'Failed',
};

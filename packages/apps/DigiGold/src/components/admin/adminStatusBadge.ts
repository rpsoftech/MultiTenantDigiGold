import type { BadgeVariant } from '@/components/common/Badge/Badge';
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

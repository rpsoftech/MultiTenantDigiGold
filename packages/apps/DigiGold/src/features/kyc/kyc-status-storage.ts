import type { KycStatus } from '@/store/session/session.types';

// TODO: confirm with backend: MainServer has no endpoint that returns a customer's
// kyc_status (not in the JWT, login response, or /user/portfolio). Until it does, remember
// the status we last knew per user so a refresh doesn't reset a submitted KYC to
// "not_started". Admin approval/rejection can't be observed from here.
const KEY_PREFIX = 'kyc_status:';
const KNOWN_STATUSES: readonly KycStatus[] = ['not_started', 'pending', 'verified', 'rejected'];

export function getStoredKycStatus(userId: string): KycStatus {
  if (typeof window === 'undefined' || !userId) return 'not_started';
  try {
    const stored = window.localStorage.getItem(KEY_PREFIX + userId);
    return KNOWN_STATUSES.find((status) => status === stored) ?? 'not_started';
  } catch {
    return 'not_started';
  }
}

export function setStoredKycStatus(userId: string, status: KycStatus): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    window.localStorage.setItem(KEY_PREFIX + userId, status);
  } catch {
    // Storage unavailable (private mode / quota): the in-memory session still updates.
  }
}

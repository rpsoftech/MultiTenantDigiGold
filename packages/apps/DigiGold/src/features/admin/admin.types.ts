import type { KycStatus } from '@/store/session/session.types';

export type { KycStatus };

export type AdminStats = {
  totalVolumeGrams: number;
  totalRevenueInr: number;
  totalMarginEarned: number;
  totalTransactions: number;
};

export type AdminUserSummary = {
  userId: string;
  name: string;
  mobileNumber: string;
  email?: string;
  goldBalanceGrams: number;
  kycStatus: KycStatus;
  joinedAt: string;
};

export type AdminLedgerEntry = {
  id: string;
  eventType: string;
  paymentMode: string;
  weightGrams: number;
  amountInr: number;
  runningGoldBalanceGrams: number;
  timestamp: string;
  referenceId?: string;
  isReversed: boolean;
  reversesLedgerId?: string;
};

// The store endpoints return page and limit, but no total count or next cursor.
// A full page indicates that another page may exist.
export type StorePage<T> = {
  items: T[];
  page: number;
  limit: number;
  hasNextPage: boolean;
};

export type UpdateKycStatusPayload = {
  userId: string;
  kycStatus: Extract<KycStatus, 'verified' | 'rejected'>;
};

// MainServer refuses to reverse a SYSTEM_REVERSAL or an entry that already has a reversal.
// Whether a redemption is still pending is not in the ledger payload, so the server
// answers 409 ERROR_LEDGER_REVERSAL for a collected one.
export function canReverseLedgerEntry(entry: AdminLedgerEntry): boolean {
  return !entry.isReversed && entry.eventType !== 'SYSTEM_REVERSAL';
}

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

import type { KycStatus } from '@/store/session/session.types';

// NOTE: candidate for @digigold/core once MainServer exposes admin endpoints — these
// mirror the expected request/response shapes for the tenant admin control panel.

export type { KycStatus };

export type AdminStats = {
  totalVaultedGoldGrams: number;
  registeredUsers: number;
  pendingKycCount: number;
  spotRatePerGramInr: number;
};

export type AdminUserSummary = {
  userId: string;
  name: string;
  mobileNumber: string;
  email?: string;
  city: string;
  goldBalanceGrams: number;
  kycStatus: KycStatus;
  joinedAt: string; // ISO string
};

export type AdminTransactionStatus = 'success' | 'failed' | 'pending';
export type AdminTransactionType = 'buy' | 'sell';

export type AdminTransaction = {
  id: string;
  userId: string;
  userName: string;
  type: AdminTransactionType;
  timestamp: string; // ISO string
  deltaGrams: number;
  amountInr: number;
  status: AdminTransactionStatus;
};

export type UpdateKycStatusPayload = {
  userId: string;
  kycStatus: Extract<KycStatus, 'verified' | 'rejected'>;
};

// Transactional volume aggregated in both currency and weight, rolled up by period.
export type PeriodMetric = {
  amountInr: number;
  grams: number;
};

export type TransactionStats = {
  lifetime: PeriodMetric;
  today: PeriodMetric;
  last7Days: PeriodMetric;
  last30Days: PeriodMetric;
};

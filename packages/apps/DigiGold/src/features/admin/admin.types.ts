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
  city: string;
  goldBalanceGrams: number;
  kycStatus: KycStatus;
};

export type AdminTransactionStatus = 'success' | 'failed' | 'pending';

export type AdminTransaction = {
  id: string;
  timestamp: string; // ISO string
  deltaGrams: number;
  amountInr: number;
  status: AdminTransactionStatus;
};

export type UpdateKycStatusPayload = {
  userId: string;
  kycStatus: Extract<KycStatus, 'verified' | 'rejected'>;
};

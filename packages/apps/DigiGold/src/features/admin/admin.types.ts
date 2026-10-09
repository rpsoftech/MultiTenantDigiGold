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

// Mirrors the submitted document_json: MainServer stores only pan_number and aadhaar_last4,
// and anything else it may add later is surfaced as `other` rather than dropped.
export type KycDocuments = {
  panNumber?: string;
  aadhaarLast4?: string;
  other: { label: string; value: string }[];
};

export type PendingKycSubmission = {
  userId: string;
  name: string;
  mobileNumber: string;
  email?: string;
  city?: string;
  goldBalanceGrams: number;
  documents: KycDocuments;
};

export type UpdateKycStatusPayload = {
  userId: string;
  kycStatus: Extract<KycStatus, 'verified' | 'rejected'>;
};

export type CounterPaymentMode = 'COUNTER_CASH' | 'COUNTER_UPI';

// Exactly one of weightGrams / amountInr is sent. MainServer sizes the trade from the grams
// when both are present, so the form only ever supplies the one the cashier typed.
export type CounterTradePayload = {
  userId: string;
  ratePerGram: number;
  weightGrams?: number;
  amountInr?: number;
  paymentMode: CounterPaymentMode;
};

export type CounterTradeReceipt = {
  id: string;
  eventType: string;
  paymentMode: string;
  weightGrams: number;
  amountInr: number;
  ratePerGram: number;
  mcxBaseRate: number;
  marginInr: number;
  gstInr: number;
  runningGoldBalanceGrams: number;
  createdAt: string;
};

// MainServer refuses to reverse a SYSTEM_REVERSAL or an entry that already has a reversal.
// Whether a redemption is still pending is not in the ledger payload, so the server
// answers 409 ERROR_LEDGER_REVERSAL for a collected one.
export function canReverseLedgerEntry(entry: AdminLedgerEntry): boolean {
  return !entry.isReversed && entry.eventType !== 'SYSTEM_REVERSAL';
}

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

export type AuditEvent = {
  id: string;
  key: string;
  // A tenant UUID for most events, but logins and trades are stored under the numeric tenant ID.
  tenantId: string;
  eventName: string;
  isProcessed: boolean;
  parentNames: string[];
  // The shape depends on the event, so it stays untyped until it is displayed.
  payload: unknown;
  ipAddress?: string;
  adminId?: string;
  occurredAt: string;
};

export type AuditEventFilters = {
  tenantUuid?: string;
  type?: string;
  // Calendar dates as YYYY-MM-DD, both inclusive.
  from?: string;
  to?: string;
};

export type AuditEventsPage = {
  items: AuditEvent[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type AdminTenantOption = {
  tenantUuid: string;
  name: string;
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
  // When the customer submitted these details (ISO); the queue is oldest first.
  submittedAt?: string;
};

// A customer's request to collect physical gold at the counter. MainServer never sends the
// pickup code to staff: the customer reads it out and staff type it in.
export type PendingRedemption = {
  id: string;
  ledgerId: string;
  weightGrams: number;
  requestedAt: string;
  customerName: string;
  customerPhone: string;
  // Pickup-code tries left before MainServer locks the request (0 = locked: it can only be
  // cancelled, which returns the gold to the vault).
  codeAttemptsLeft: number;
};

// A pickup handed over at the counter today, for the end-of-day count.
export type CollectedRedemption = {
  id: string;
  weightGrams: number;
  requestedAt: string;
  collectedAt: string;
  customerName: string;
  customerPhone: string;
  // Username of the staff member who handed it over.
  collectedBy: string;
};

export type CollectRedemptionPayload = {
  redemptionId: string;
  pickupCode: string;
};

export type UpdateKycStatusPayload = {
  userId: string;
  kycStatus: Extract<KycStatus, 'verified' | 'rejected'>;
};

export type CounterPaymentMode = 'COUNTER_CASH' | 'COUNTER_UPI';

// A counter sale is priced by MainServer first (the quote) and recorded second, so the
// cashier collects exactly what is recorded. Exactly one of weightGrams / amountInr is
// sent: the one the cashier typed.
export type CounterQuoteRequest = {
  userId: string;
  weightGrams?: number;
  amountInr?: number;
  paymentMode: CounterPaymentMode;
};

// The store's own price for the sale, held until expiresAt (epoch ms).
export type CounterQuote = {
  quoteId: string;
  paymentMode: CounterPaymentMode;
  weightGrams: number;
  amountInr: number;
  ratePerGram: number;
  mcxBaseRate: number;
  marginPerGramInr: number;
  gstPerGramInr: number;
  expiresAt: number;
};

export type CounterTradeReceipt = {
  id: string;
  eventType: string;
  paymentMode: string;
  weightGrams: number;
  amountInr: number;
  ratePerGram: number;
  mcxBaseRate: number;
  marginPerGramInr: number;
  gstPerGramInr: number;
  runningGoldBalanceGrams: number;
  createdAt: string;
  // True when this quote had been confirmed before: the sale shown is that earlier one.
  alreadyRecorded: boolean;
};

// MainServer refuses to reverse a SYSTEM_REVERSAL or an entry that already has a reversal.
// Whether a redemption is still pending is not in the ledger payload, so the server
// answers 409 ERROR_LEDGER_REVERSAL for a collected one.
export function canReverseLedgerEntry(entry: AdminLedgerEntry): boolean {
  return !entry.isReversed && entry.eventType !== 'SYSTEM_REVERSAL';
}

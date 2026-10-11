import { sizeCounterTrade } from './counterTrade.utils';
import type {
  AdminLedgerEntry,
  CounterQuote,
  CounterQuoteRequest,
  CounterTradeReceipt,
  AdminStats,
  AdminUserSummary,
  PendingKycSubmission,
  StorePage,
} from './admin.types';

const MOCK_STATS: AdminStats = {
  totalVolumeGrams: 1140.32,
  totalRevenueInr: 8245310,
  totalMarginEarned: 164906.2,
  totalTransactions: 286,
};

const MOCK_USERS: AdminUserSummary[] = [
  {
    userId: 'USR-101',
    name: 'Aarav Sharma',
    mobileNumber: '9876543210',
    email: 'aarav.sharma@example.com',
    goldBalanceGrams: 12.45,
    kycStatus: 'verified',
    joinedAt: '2026-08-01T09:00:00.000Z',
  },
  {
    userId: 'USR-102',
    name: 'Priya Patel',
    mobileNumber: '9123456789',
    email: 'priya.patel@example.com',
    goldBalanceGrams: 2.1,
    kycStatus: 'pending',
    joinedAt: '2026-07-28T11:30:00.000Z',
  },
  {
    userId: 'USR-103',
    name: 'Rohan Verma',
    mobileNumber: '9988776655',
    email: 'rohan.verma@example.com',
    goldBalanceGrams: 0,
    kycStatus: 'rejected',
    joinedAt: '2026-07-20T15:45:00.000Z',
  },
];

const MOCK_LEDGER: AdminLedgerEntry[] = [
  {
    id: 'GL-9935',
    eventType: 'SYSTEM_REVERSAL',
    paymentMode: 'NONE',
    weightGrams: -2.75,
    amountInr: -19874.42,
    runningGoldBalanceGrams: 0,
    timestamp: '2026-08-18T10:25:00.000Z',
    referenceId: 'REVERSAL_GL-9915',
    reversesLedgerId: 'GL-9915',
    isReversed: false,
  },
  {
    id: 'GL-9931',
    eventType: 'GOLD_PURCHASE',
    paymentMode: 'ONLINE_PG',
    weightGrams: 1.2,
    amountInr: 8672.47,
    runningGoldBalanceGrams: 12.45,
    timestamp: '2026-08-18T09:15:00.000Z',
    referenceId: 'pay_demo_9931',
    isReversed: false,
  },
  {
    id: 'GL-9928',
    eventType: 'PHYSICAL_REDEMPTION',
    paymentMode: 'NONE',
    weightGrams: -0.5,
    amountInr: 3613.53,
    runningGoldBalanceGrams: 2.1,
    timestamp: '2026-08-17T18:40:00.000Z',
    isReversed: false,
  },
  {
    id: 'GL-9915',
    eventType: 'GOLD_PURCHASE',
    paymentMode: 'COUNTER_UPI',
    weightGrams: 2.75,
    amountInr: 19874.42,
    runningGoldBalanceGrams: 2.75,
    timestamp: '2026-08-16T12:05:00.000Z',
    isReversed: true,
  },
  {
    id: 'GL-9890',
    eventType: 'GOLD_PURCHASE',
    paymentMode: 'COUNTER_CASH',
    weightGrams: 4.1,
    amountInr: 29631.02,
    runningGoldBalanceGrams: 4.1,
    timestamp: '2026-08-10T16:20:00.000Z',
    isReversed: false,
  },
];

function paginate<T>(items: T[], page: number, limit: number): StorePage<T> {
  const pageItems = items.slice((page - 1) * limit, page * limit);
  return {
    items: pageItems,
    page,
    limit,
    hasNextPage: pageItems.length === limit,
  };
}

export async function mockGetAdminStats(): Promise<AdminStats> {
  return { ...MOCK_STATS };
}

export async function mockGetAdminUsers(
  page = 1,
  limit = 20,
): Promise<StorePage<AdminUserSummary>> {
  return paginate(
    MOCK_USERS.map((user) => ({ ...user })),
    page,
    limit,
  );
}

const MOCK_KYC_DOCUMENTS: Record<string, PendingKycSubmission['documents']> = {
  'USR-102': { panNumber: 'ABCDE1234F', aadhaarLast4: '4821', other: [] },
};
const MOCK_KYC_SUBMITTED_AT: Record<string, string> = {
  'USR-102': '2026-08-02T10:15:00.000Z',
};

// A submission waiting for review, as MainServer defines it: pending with documents.
function awaitingKycReview(user: AdminUserSummary) {
  return (
    user.kycStatus === 'pending' && Boolean(MOCK_KYC_DOCUMENTS[user.userId])
  );
}

export async function mockGetPendingKyc(
  page = 1,
  limit = 20,
): Promise<StorePage<PendingKycSubmission>> {
  const pending = MOCK_USERS.filter(awaitingKycReview).map(
    (user): PendingKycSubmission => ({
      userId: user.userId,
      name: user.name,
      mobileNumber: user.mobileNumber,
      email: user.email,
      goldBalanceGrams: user.goldBalanceGrams,
      documents: MOCK_KYC_DOCUMENTS[user.userId],
      submittedAt: MOCK_KYC_SUBMITTED_AT[user.userId],
    }),
  );
  return paginate(pending, page, limit);
}

export async function mockGetStoreLedger(
  page = 1,
  limit = 20,
): Promise<StorePage<AdminLedgerEntry>> {
  return paginate(
    MOCK_LEDGER.map((entry) => ({ ...entry })),
    page,
    limit,
  );
}

export async function mockUpdateKycStatus(
  userId: string,
  kycStatus: AdminUserSummary['kycStatus'],
): Promise<void> {
  const user = MOCK_USERS.find((candidate) => candidate.userId === userId);
  if (!user) throw new Error(`Unknown store customer: ${userId}`);
  // Like MainServer: only a submission waiting for review can be decided, once.
  if (!awaitingKycReview(user)) {
    throw {
      message:
        'This customer has no KYC submission waiting for review. Another admin may already have decided it.',
      code: 'KYC_NOT_AWAITING_REVIEW',
      status: 409,
    };
  }
  user.kycStatus = kycStatus;
}

export async function mockReverseLedgerEntry(ledgerId: string): Promise<void> {
  const entry = MOCK_LEDGER.find((candidate) => candidate.id === ledgerId);
  if (!entry) throw new Error(`Unknown ledger entry: ${ledgerId}`);
  if (entry.isReversed || entry.eventType === 'SYSTEM_REVERSAL') {
    throw {
      message: entry.isReversed
        ? 'ledger entry is already reversed'
        : 'ledger entry cannot be reversed',
      code: 'ERROR_LEDGER_REVERSAL',
      status: 409,
    };
  }
  entry.isReversed = true;
  // The sample ledger has no customer ids, so the balance after the reversal is the one
  // before the original entry.
  MOCK_LEDGER.unshift({
    id: `${entry.id}-R`,
    eventType: 'SYSTEM_REVERSAL',
    paymentMode: 'NONE',
    weightGrams: -entry.weightGrams,
    amountInr: -entry.amountInr,
    runningGoldBalanceGrams: entry.runningGoldBalanceGrams - entry.weightGrams,
    timestamp: new Date().toISOString(),
    referenceId: `REVERSAL_${entry.id}`,
    reversesLedgerId: entry.id,
    isReversed: false,
  });
}

// Sample store pricing, as MainServer's demo seed: MCX ask ₹7,000/g, ₹100/g margin, 3% GST.
const MOCK_MCX_RATE = 7000;
const MOCK_MARGIN_PER_GRAM = 100;
const MOCK_GST_PER_GRAM =
  Math.round((MOCK_MCX_RATE + MOCK_MARGIN_PER_GRAM) * 3) / 100;
const MOCK_RATE_PER_GRAM =
  MOCK_MCX_RATE + MOCK_MARGIN_PER_GRAM + MOCK_GST_PER_GRAM;
const MOCK_QUOTE_VALIDITY_MS = 5 * 60 * 1000;
// Income Tax Act s.269ST, enforced by MainServer per customer per day.
const MOCK_CASH_LIMIT_INR = 200000;

const mockQuotes = new Map<string, CounterQuote & { userId: string }>();
const mockConfirmed = new Map<string, CounterTradeReceipt>();
const mockCashToday = new Map<string, number>();

function todayKey(userId: string) {
  const day = new Date().toLocaleDateString('en-CA', {
    timeZone: 'Asia/Kolkata',
  });
  return `${day}:${userId}`;
}

function checkMockCash(
  request: { userId: string; paymentMode: string },
  amountInr: number,
) {
  const today = mockCashToday.get(todayKey(request.userId)) ?? 0;
  if (
    request.paymentMode === 'COUNTER_CASH' &&
    today + amountInr >= MOCK_CASH_LIMIT_INR
  ) {
    throw {
      message:
        'Cash received from this customer today would reach ₹2,00,000, which the law does not allow. Take the rest by UPI.',
      code: 'CASH_LIMIT_EXCEEDED',
      status: 400,
    };
  }
}

export async function mockQuoteCounterTrade(
  request: CounterQuoteRequest,
): Promise<CounterQuote> {
  if (!MOCK_USERS.some((candidate) => candidate.userId === request.userId)) {
    throw {
      message: 'The requested user could not be found.',
      code: 'ERROR_USER_NOT_FOUND',
      status: 404,
    };
  }
  const sized = sizeCounterTrade(MOCK_RATE_PER_GRAM, {
    weightGrams: request.weightGrams,
    amountInr: request.amountInr,
  });
  if (!sized) {
    throw {
      message: 'must specify a positive weight_grams or total_amount_inr',
      code: 'INVALID_PAYLOAD',
      status: 400,
    };
  }
  checkMockCash(request, sized.amountInr);
  const quote: CounterQuote = {
    quoteId: `quote-${Date.now()}-${mockQuotes.size + 1}`,
    paymentMode: request.paymentMode,
    weightGrams: sized.weightGrams,
    amountInr: sized.amountInr,
    ratePerGram: MOCK_RATE_PER_GRAM,
    mcxBaseRate: MOCK_MCX_RATE,
    marginPerGramInr: MOCK_MARGIN_PER_GRAM,
    gstPerGramInr: MOCK_GST_PER_GRAM,
    expiresAt: Date.now() + MOCK_QUOTE_VALIDITY_MS,
  };
  mockQuotes.set(quote.quoteId, { ...quote, userId: request.userId });
  return { ...quote };
}

// Like MainServer: a quote is recorded once; confirming it again returns that sale.
export async function mockCreateCounterTrade(
  quoteId: string,
): Promise<CounterTradeReceipt> {
  const recorded = mockConfirmed.get(quoteId);
  if (recorded) return { ...recorded, alreadyRecorded: true };

  const quote = mockQuotes.get(quoteId);
  if (!quote || quote.expiresAt < Date.now()) {
    throw {
      message:
        'This price has expired. Get a new price before confirming the sale.',
      code: 'COUNTER_QUOTE_EXPIRED',
      status: 409,
    };
  }
  const user = MOCK_USERS.find(
    (candidate) => candidate.userId === quote.userId,
  );
  if (!user) throw new Error(`Unknown store customer: ${quote.userId}`);
  checkMockCash(
    { userId: quote.userId, paymentMode: quote.paymentMode },
    quote.amountInr,
  );

  user.goldBalanceGrams =
    Math.round((user.goldBalanceGrams + quote.weightGrams) * 10000) / 10000;
  if (quote.paymentMode === 'COUNTER_CASH') {
    const key = todayKey(quote.userId);
    mockCashToday.set(key, (mockCashToday.get(key) ?? 0) + quote.amountInr);
  }
  const receipt: CounterTradeReceipt = {
    id: `GL-${Date.now()}`,
    eventType: 'GOLD_PURCHASE',
    paymentMode: quote.paymentMode,
    weightGrams: quote.weightGrams,
    amountInr: quote.amountInr,
    ratePerGram: quote.ratePerGram,
    mcxBaseRate: quote.mcxBaseRate,
    marginPerGramInr: quote.marginPerGramInr,
    gstPerGramInr: quote.gstPerGramInr,
    runningGoldBalanceGrams: user.goldBalanceGrams,
    createdAt: new Date().toISOString(),
    alreadyRecorded: false,
  };
  mockConfirmed.set(quoteId, receipt);
  mockQuotes.delete(quoteId);
  return { ...receipt };
}

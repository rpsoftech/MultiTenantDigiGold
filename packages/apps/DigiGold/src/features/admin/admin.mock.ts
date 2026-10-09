import { sizeCounterTrade } from './counterTrade.utils';
import type {
  AdminLedgerEntry,
  CounterTradePayload,
  CounterTradeReceipt,
  AdminStats,
  AdminUserSummary,
  PendingKycSubmission,
  PendingRedemption,
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

export async function mockGetPendingKyc(
  page = 1,
  limit = 20,
): Promise<StorePage<PendingKycSubmission>> {
  const pending = MOCK_USERS.filter(
    (user) => user.kycStatus === 'pending' && MOCK_KYC_DOCUMENTS[user.userId],
  ).map(
    (user): PendingKycSubmission => ({
      userId: user.userId,
      name: user.name,
      mobileNumber: user.mobileNumber,
      email: user.email,
      goldBalanceGrams: user.goldBalanceGrams,
      documents: MOCK_KYC_DOCUMENTS[user.userId],
    }),
  );
  return paginate(pending, page, limit);
}

type MockRedemption = PendingRedemption & {
  status: 'PENDING' | 'COLLECTED' | 'CANCELLED';
  // Real pickup codes never reach staff; the sample data keeps them here so the screen can be
  // tried without a server. Aarav: 482915 and 159037, Priya: 730264.
  pickupCode: string;
};

const MOCK_REDEMPTIONS: MockRedemption[] = [
  {
    id: 'RDM-201',
    ledgerId: 'GL-9941',
    weightGrams: 5,
    requestedAt: '2026-10-08T09:30:00.000Z',
    customerName: 'Aarav Sharma',
    customerPhone: '9876543210',
    status: 'PENDING',
    pickupCode: '482915',
  },
  {
    id: 'RDM-202',
    ledgerId: 'GL-9942',
    weightGrams: 2.5,
    requestedAt: '2026-10-08T11:05:00.000Z',
    customerName: 'Priya Patel',
    customerPhone: '9123456789',
    status: 'PENDING',
    pickupCode: '730264',
  },
  {
    id: 'RDM-203',
    ledgerId: 'GL-9943',
    weightGrams: 1.25,
    requestedAt: '2026-10-09T08:15:00.000Z',
    customerName: 'Aarav Sharma',
    customerPhone: '9876543210',
    status: 'PENDING',
    pickupCode: '159037',
  },
];

// Same shape the API client produces for a MainServer error response.
function redemptionError(status: number, code: string, message: string) {
  return { status, code, message };
}

function findPendingRedemption(id: string): MockRedemption {
  const redemption = MOCK_REDEMPTIONS.find((candidate) => candidate.id === id);
  if (!redemption) {
    throw redemptionError(
      404,
      'REDEMPTION_NOT_FOUND',
      'Redemption request not found.',
    );
  }
  if (redemption.status !== 'PENDING') {
    throw redemptionError(
      409,
      'REDEMPTION_NOT_PENDING',
      'Redemption is no longer pending.',
    );
  }
  return redemption;
}

export async function mockGetPendingRedemptions(
  page = 1,
  limit = 20,
  phone = '',
): Promise<StorePage<PendingRedemption>> {
  const pending = MOCK_REDEMPTIONS.filter(
    (redemption) =>
      redemption.status === 'PENDING' &&
      (!phone || redemption.customerPhone === phone),
  ).map(
    ({
      id,
      ledgerId,
      weightGrams,
      requestedAt,
      customerName,
      customerPhone,
    }) => ({
      id,
      ledgerId,
      weightGrams,
      requestedAt,
      customerName,
      customerPhone,
    }),
  );
  return paginate(pending, page, limit);
}

export async function mockCollectRedemption(
  id: string,
  pickupCode: string,
): Promise<void> {
  const redemption = findPendingRedemption(id);
  if (redemption.pickupCode !== pickupCode) {
    throw redemptionError(
      400,
      'INVALID_PICKUP_CODE',
      'Pickup code does not match.',
    );
  }
  redemption.status = 'COLLECTED';
}

export async function mockCancelRedemption(id: string): Promise<void> {
  findPendingRedemption(id).status = 'CANCELLED';
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
}

export async function mockCreateCounterTrade(
  payload: CounterTradePayload,
): Promise<CounterTradeReceipt> {
  const user = MOCK_USERS.find((candidate) => candidate.userId === payload.userId);
  if (!user) throw new Error(`Unknown store customer: ${payload.userId}`);
  const sized = sizeCounterTrade(payload.ratePerGram, {
    weightGrams: payload.weightGrams,
    amountInr: payload.amountInr,
  });
  if (!sized) {
    throw {
      message: 'must specify a positive weight_grams or total_amount_inr',
      code: 'INVALID_PAYLOAD',
      status: 400,
    };
  }
  user.goldBalanceGrams =
    Math.round((user.goldBalanceGrams + sized.weightGrams) * 10000) / 10000;
  return {
    id: `GL-${Date.now()}`,
    eventType: 'GOLD_PURCHASE',
    paymentMode: payload.paymentMode,
    weightGrams: sized.weightGrams,
    amountInr: sized.amountInr,
    ratePerGram: payload.ratePerGram,
    mcxBaseRate: Math.round(payload.ratePerGram / 1.0609),
    marginInr: 100,
    gstInr: Math.round(payload.ratePerGram - payload.ratePerGram / 1.03),
    runningGoldBalanceGrams: user.goldBalanceGrams,
    createdAt: new Date().toISOString(),
  };
}

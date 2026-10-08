import type {
  AdminLedgerEntry,
  AdminStats,
  AdminUserSummary,
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

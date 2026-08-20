import type {
  AdminStats,
  AdminTransaction,
  AdminUserSummary,
  TransactionStats,
} from './admin.types';

// MainServer's admin endpoints aren't ready yet — swapping to the real calls in
// admin.service.ts is a one-line change (flip NEXT_PUBLIC_USE_MOCK_ADMIN).

const MOCK_STATS: AdminStats = {
  totalVaultedGoldGrams: 14.55,
  registeredUsers: 3,
  pendingKycCount: 1,
  spotRatePerGramInr: 7227.06,
};

const MOCK_USERS: AdminUserSummary[] = [
  {
    userId: 'USR-101',
    name: 'Aarav Sharma',
    mobileNumber: '9876543210',
    email: 'aarav.sharma@example.com',
    city: 'Mumbai',
    goldBalanceGrams: 12.45,
    kycStatus: 'verified',
    joinedAt: '2026-08-01T09:00:00.000Z',
  },
  {
    userId: 'USR-102',
    name: 'Priya Patel',
    mobileNumber: '9123456789',
    email: 'priya.patel@example.com',
    city: 'Ahmedabad',
    goldBalanceGrams: 2.1,
    kycStatus: 'pending',
    joinedAt: '2026-07-28T11:30:00.000Z',
  },
  {
    userId: 'USR-103',
    name: 'Rohan Verma',
    mobileNumber: '9988776655',
    email: 'rohan.verma@example.com',
    city: 'Bangalore',
    goldBalanceGrams: 0,
    kycStatus: 'rejected',
    joinedAt: '2026-07-20T15:45:00.000Z',
  },
];

const MOCK_TRANSACTIONS: Record<string, AdminTransaction[]> = {
  'USR-101': [
    {
      id: 'TXN-8821',
      userId: 'USR-101',
      userName: 'Aarav Sharma',
      type: 'buy',
      timestamp: '2026-08-01T14:22:00.000Z',
      deltaGrams: 5,
      amountInr: 36250,
      status: 'success',
    },
    {
      id: 'TXN-7719',
      userId: 'USR-101',
      userName: 'Aarav Sharma',
      type: 'buy',
      timestamp: '2026-07-15T10:11:00.000Z',
      deltaGrams: 7.45,
      amountInr: 54012.5,
      status: 'success',
    },
  ],
};

const MOCK_RECENT_TRANSACTIONS: AdminTransaction[] = [
  {
    id: 'TXN-9931',
    userId: 'USR-101',
    userName: 'Aarav Sharma',
    type: 'buy',
    timestamp: '2026-08-18T09:15:00.000Z',
    deltaGrams: 1.2,
    amountInr: 8672.47,
    status: 'success',
  },
  {
    id: 'TXN-9928',
    userId: 'USR-102',
    userName: 'Priya Patel',
    type: 'sell',
    timestamp: '2026-08-17T18:40:00.000Z',
    deltaGrams: 0.5,
    amountInr: 3613.53,
    status: 'success',
  },
  {
    id: 'TXN-9915',
    userId: 'USR-103',
    userName: 'Rohan Verma',
    type: 'buy',
    timestamp: '2026-08-16T12:05:00.000Z',
    deltaGrams: 2.75,
    amountInr: 19874.42,
    status: 'pending',
  },
  {
    id: 'TXN-9902',
    userId: 'USR-101',
    userName: 'Aarav Sharma',
    type: 'sell',
    timestamp: '2026-08-14T08:50:00.000Z',
    deltaGrams: 3,
    amountInr: 21681.18,
    status: 'success',
  },
  {
    id: 'TXN-9890',
    userId: 'USR-102',
    userName: 'Priya Patel',
    type: 'buy',
    timestamp: '2026-08-10T16:20:00.000Z',
    deltaGrams: 4.1,
    amountInr: 29631.02,
    status: 'failed',
  },
];

const MOCK_TRANSACTION_STATS: TransactionStats = {
  lifetime: { amountInr: 8245310, grams: 1140.32 },
  today: { amountInr: 32460, grams: 4.48 },
  last7Days: { amountInr: 214870, grams: 29.72 },
  last30Days: { amountInr: 912640, grams: 126.16 },
};

export async function mockGetAdminStats(): Promise<AdminStats> {
  return MOCK_STATS;
}

export async function mockGetAdminUsers(): Promise<AdminUserSummary[]> {
  return MOCK_USERS;
}

export async function mockGetUserTransactions(userId: string): Promise<AdminTransaction[]> {
  return MOCK_TRANSACTIONS[userId] ?? [];
}

export async function mockGetTransactionStats(): Promise<TransactionStats> {
  return MOCK_TRANSACTION_STATS;
}

export async function mockGetRecentTransactions(): Promise<AdminTransaction[]> {
  return [...MOCK_RECENT_TRANSACTIONS]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 5);
}

export async function mockGetRecentUsers(): Promise<AdminUserSummary[]> {
  return [...MOCK_USERS]
    .sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime())
    .slice(0, 5);
}

export async function mockUpdateKycStatus(
  userId: string,
  kycStatus: AdminUserSummary['kycStatus']
): Promise<AdminUserSummary> {
  const user = MOCK_USERS.find((candidate) => candidate.userId === userId);
  if (!user) throw new Error(`Unknown admin user: ${userId}`);
  user.kycStatus = kycStatus;
  return user;
}

import type { AdminStats, AdminTransaction, AdminUserSummary } from './admin.types';

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
    city: 'Mumbai',
    goldBalanceGrams: 12.45,
    kycStatus: 'verified',
  },
  {
    userId: 'USR-102',
    name: 'Priya Patel',
    mobileNumber: '9123456789',
    city: 'Ahmedabad',
    goldBalanceGrams: 2.1,
    kycStatus: 'pending',
  },
  {
    userId: 'USR-103',
    name: 'Rohan Verma',
    mobileNumber: '9988776655',
    city: 'Bangalore',
    goldBalanceGrams: 0,
    kycStatus: 'rejected',
  },
];

const MOCK_TRANSACTIONS: Record<string, AdminTransaction[]> = {
  'USR-101': [
    {
      id: 'TXN-8821',
      timestamp: '2026-08-01T14:22:00.000Z',
      deltaGrams: 5,
      amountInr: 36250,
      status: 'success',
    },
    {
      id: 'TXN-7719',
      timestamp: '2026-07-15T10:11:00.000Z',
      deltaGrams: 7.45,
      amountInr: 54012.5,
      status: 'success',
    },
  ],
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

export async function mockUpdateKycStatus(
  userId: string,
  kycStatus: AdminUserSummary['kycStatus']
): Promise<AdminUserSummary> {
  const user = MOCK_USERS.find((candidate) => candidate.userId === userId);
  if (!user) throw new Error(`Unknown admin user: ${userId}`);
  user.kycStatus = kycStatus;
  return user;
}

import { afterEach, describe, expect, it } from '@jest/globals';
import { cleanup, render } from '@testing-library/react';
import type {
  AdminLedgerEntry,
  AdminUserSummary,
} from '@/features/admin/admin.types';
import { RecentTransactionsTable } from './RecentTransactionsTable/RecentTransactionsTable';
import { RecentUsersTable } from './RecentUsersTable/RecentUsersTable';
import { CustomerDirectoryTable } from './CustomerDirectoryTable/CustomerDirectoryTable';

const user: AdminUserSummary = {
  userId: 'U1',
  name: 'Asha Rao',
  mobileNumber: '9876543210',
  email: 'asha@example.com',
  goldBalanceGrams: 1.5,
  kycStatus: 'pending',
  joinedAt: '2026-01-01T00:00:00.000Z',
};

const transaction: AdminLedgerEntry = {
  id: 'T1',
  eventType: 'GOLD_PURCHASE',
  paymentMode: 'COUNTER_CASH',
  timestamp: '2026-01-02T00:00:00.000Z',
  weightGrams: 0.5,
  amountInr: 3000,
  runningGoldBalanceGrams: 1.5,
  isReversed: false,
};

jest.mock('@/features/admin/hooks/useRecentUsers', () => ({
  useRecentUsers: () => ({ data: [user], isLoading: false }),
}));
jest.mock('@/features/admin/hooks/useAdminUsers', () => ({
  useAdminUsers: () => ({
    data: { items: [user], page: 1, limit: 20, hasNextPage: false },
    isLoading: false,
  }),
}));
jest.mock('@/features/admin/hooks/useRecentTransactions', () => ({
  useRecentTransactions: () => ({ data: [transaction], isLoading: false }),
}));

afterEach(cleanup);

// The tables collapse into labelled cards below the md breakpoint, and that layout reads each
// cell's caption from its data-label, so every data cell must carry one.
function dataLabels(container: HTMLElement) {
  return Array.from(container.querySelectorAll('tbody td'))
    .map((cell) => cell.getAttribute('data-label'))
    .filter(Boolean);
}

// In the stacked layout each cell is a flex row (caption, value), so a cell with several parts
// must wrap them in one element; otherwise e.g. a name and its user ID are spread apart.
function cellsWithLooseParts(container: HTMLElement) {
  return Array.from(container.querySelectorAll('tbody td[data-label]'))
    .filter((cell) => cell.children.length > 1)
    .map((cell) => cell.getAttribute('data-label'));
}

describe('admin tables (mobile stacked layout)', () => {
  it('labels every Recent Users cell', () => {
    const { container } = render(<RecentUsersTable />);
    expect(dataLabels(container)).toEqual([
      'Customer',
      'Contact',
      'Vault balance',
      'KYC status',
      'Joined',
    ]);
  });

  it('labels every Recent Transactions cell', () => {
    const { container } = render(<RecentTransactionsTable />);
    expect(dataLabels(container)).toEqual([
      'Transaction',
      'Amount / Weight',
      'Payment mode',
      'Vault after entry',
      'Status',
      'Date & time (IST)',
    ]);
  });

  it('labels every Customer Directory cell', () => {
    const { container } = render(<CustomerDirectoryTable />);
    expect(dataLabels(container)).toEqual([
      'Customer',
      'Contact',
      'Vault balance',
      'KYC status',
      'Joined',
    ]);
    expect(container.querySelectorAll('tbody td')).toHaveLength(5);
  });

  it('wraps multi-part cells in a single element', () => {
    const { container } = render(
      <>
        <RecentUsersTable />
        <RecentTransactionsTable />
        <CustomerDirectoryTable />
      </>,
    );
    expect(cellsWithLooseParts(container)).toEqual([]);
  });
});

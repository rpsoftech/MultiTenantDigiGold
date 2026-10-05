import { afterEach, describe, expect, it } from '@jest/globals';
import { cleanup, render } from '@testing-library/react';
import type { AdminTransaction, AdminUserSummary } from '@/features/admin/admin.types';
import { RecentTransactionsTable } from './RecentTransactionsTable/RecentTransactionsTable';
import { RecentUsersTable } from './RecentUsersTable/RecentUsersTable';
import { UserApprovalsTable } from './UserApprovalsTable/UserApprovalsTable';

const user: AdminUserSummary = {
  userId: 'U1',
  name: 'Asha Rao',
  mobileNumber: '9876543210',
  email: 'asha@example.com',
  city: 'Pune',
  goldBalanceGrams: 1.5,
  kycStatus: 'pending',
  joinedAt: '2026-01-01T00:00:00.000Z',
};

const transaction: AdminTransaction = {
  id: 'T1',
  userId: 'U1',
  userName: 'Asha Rao',
  type: 'buy',
  timestamp: '2026-01-02T00:00:00.000Z',
  deltaGrams: 0.5,
  amountInr: 3000,
  status: 'success',
};

jest.mock('@/features/admin/hooks/useRecentUsers', () => ({
  useRecentUsers: () => ({ data: [user], isLoading: false }),
}));
jest.mock('@/features/admin/hooks/useAdminUsers', () => ({
  useAdminUsers: () => ({ data: [user], isLoading: false }),
}));
jest.mock('@/features/admin/hooks/useRecentTransactions', () => ({
  useRecentTransactions: () => ({ data: [transaction], isLoading: false }),
}));
jest.mock('@/features/admin/hooks/useUpdateKycStatus', () => ({
  useUpdateKycStatus: () => ({ mutate: jest.fn(), isPending: false, variables: undefined }),
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
    expect(dataLabels(container)).toEqual(['Name', 'Email / Phone', 'Joined Date', 'Status']);
  });

  it('labels every Recent Transactions cell', () => {
    const { container } = render(<RecentTransactionsTable />);
    expect(dataLabels(container)).toEqual([
      'User',
      'Amount / Weight',
      'Type',
      'Status',
      'Timestamp',
    ]);
  });

  it('labels the User Approvals data cells and leaves the actions cell unlabelled', () => {
    const { container } = render(
      <UserApprovalsTable selectedUserId={null} onViewLogs={jest.fn()} />,
    );
    expect(dataLabels(container)).toEqual(['User', 'Mobile', 'City', 'Gold Balance', 'KYC Status']);
    expect(container.querySelectorAll('tbody td')).toHaveLength(6);
  });

  it('wraps multi-part cells in a single element', () => {
    const { container } = render(
      <>
        <RecentUsersTable />
        <RecentTransactionsTable />
        <UserApprovalsTable selectedUserId={null} onViewLogs={jest.fn()} />
      </>,
    );
    expect(cellsWithLooseParts(container)).toEqual([]);
  });
});

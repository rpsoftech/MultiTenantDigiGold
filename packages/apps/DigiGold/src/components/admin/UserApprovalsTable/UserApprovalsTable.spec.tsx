import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type {
  AdminUserSummary,
  StorePage,
  UpdateKycStatusPayload,
} from '@/features/admin/admin.types';
import { UserApprovalsTable } from './UserApprovalsTable';

const customer: AdminUserSummary = {
  userId: 'customer-1',
  name: 'Asha Rao',
  mobileNumber: '9876543210',
  email: 'asha@example.com',
  goldBalanceGrams: 1.25,
  kycStatus: 'pending',
  joinedAt: '2026-10-01T00:00:00Z',
};

const refetch = jest.fn();
const mutate = jest.fn();
const queryMock = jest.fn();
let queryState: {
  data?: StorePage<AdminUserSummary>;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  refetch: typeof refetch;
};
let mutationState: {
  mutate: typeof mutate;
  isPending: boolean;
  isError: boolean;
  variables?: UpdateKycStatusPayload;
};

jest.mock('@/features/admin/hooks/useAdminUsers', () => ({
  useAdminUsers: (page: number, limit: number) => {
    queryMock(page, limit);
    return queryState;
  },
}));
jest.mock('@/features/admin/hooks/useUpdateKycStatus', () => ({
  useUpdateKycStatus: () => mutationState,
}));

beforeEach(() => {
  jest.clearAllMocks();
  queryState = {
    data: { items: [customer], page: 1, limit: 20, hasNextPage: true },
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch,
  };
  mutationState = { mutate, isPending: false, isError: false };
});
afterEach(cleanup);

describe('customer directory', () => {
  it('requests the next page and resets to page one when the page size changes', () => {
    render(<UserApprovalsTable />);
    expect(queryMock).toHaveBeenLastCalledWith(1, 20);
    expect(
      (screen.getByRole('button', { name: 'Previous' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(queryMock).toHaveBeenLastCalledWith(2, 20);
    expect(
      (screen.getByRole('button', { name: 'Previous' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);

    fireEvent.change(screen.getByRole('combobox', { name: 'Rows per page' }), {
      target: { value: '50' },
    });
    expect(queryMock).toHaveBeenLastCalledWith(1, 50);
  });

  it('disables next when there is no following page and offers a useful empty state', () => {
    queryState.data = { items: [], page: 1, limit: 20, hasNextPage: false };
    render(<UserApprovalsTable />);
    expect(screen.getByText('No customers yet')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('retries failed customer requests without showing a perpetual loader', () => {
    queryState.data = undefined;
    queryState.isError = true;
    render(<UserApprovalsTable />);
    expect(screen.getByRole('alert').textContent).toContain(
      'Customer directory is unavailable',
    );
    expect(
      screen.queryByRole('status', { name: 'Loading customers' }),
    ).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('shows vault balance and sends the selected KYC decision for the correct customer', () => {
    render(<UserApprovalsTable />);
    expect(screen.getByText('1.2500 g')).toBeTruthy();
    expect(screen.getByText('asha@example.com')).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', { name: 'Approve KYC for Asha Rao' }),
    );
    expect(mutate).toHaveBeenLastCalledWith({
      userId: 'customer-1',
      kycStatus: 'verified',
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Reject KYC for Asha Rao' }),
    );
    expect(mutate).toHaveBeenLastCalledWith({
      userId: 'customer-1',
      kycStatus: 'rejected',
    });
    expect(screen.queryByRole('button', { name: /logs/i })).toBeNull();
  });

  it('prevents overlapping KYC decisions and reports failed updates', () => {
    mutationState.isPending = true;
    mutationState.variables = { userId: 'customer-1', kycStatus: 'verified' };
    const { rerender } = render(<UserApprovalsTable />);
    expect(
      (
        screen.getByRole('button', {
          name: 'Approve KYC for Asha Rao',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole('button', {
          name: 'Reject KYC for Asha Rao',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);

    mutationState.isPending = false;
    mutationState.isError = true;
    rerender(<UserApprovalsTable />);
    expect(screen.getByRole('alert').textContent).toContain(
      'KYC status could not be updated',
    );
  });

  it('only offers KYC actions to customers with a pending submission', () => {
    queryState.data = {
      items: [{ ...customer, kycStatus: 'not_started' }],
      page: 1,
      limit: 20,
      hasNextPage: false,
    };
    render(<UserApprovalsTable />);
    expect(screen.getByText('Not Started')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Approve KYC/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Reject KYC/ })).toBeNull();
  });
});

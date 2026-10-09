import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type {
  PendingKycSubmission,
  StorePage,
  UpdateKycStatusPayload,
} from '@/features/admin/admin.types';
import { UserApprovalsTable } from './UserApprovalsTable';

jest.mock('@/hooks/useMediaQuery', () => ({ useMediaQuery: () => true }));

const submission: PendingKycSubmission = {
  userId: 'customer-1',
  name: 'Asha Rao',
  mobileNumber: '9876543210',
  email: 'asha@example.com',
  goldBalanceGrams: 1.25,
  documents: { panNumber: 'ABCDE1234F', aadhaarLast4: '4821', other: [] },
};

const refetch = jest.fn();
const queryMock = jest.fn();
const showToast = jest.fn();
let queryState: {
  data?: StorePage<PendingKycSubmission>;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  refetch: typeof refetch;
};
type MutateOptions = {
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
};
const mutate = jest.fn<void, [UpdateKycStatusPayload, MutateOptions]>();
let mutationState: {
  mutate: typeof mutate;
  isPending: boolean;
  variables?: UpdateKycStatusPayload;
};

jest.mock('@/features/admin/hooks/usePendingKyc', () => ({
  usePendingKyc: (page: number, limit: number) => {
    queryMock(page, limit);
    return queryState;
  },
}));
jest.mock('@/features/admin/hooks/useUpdateKycStatus', () => ({
  useUpdateKycStatus: () => mutationState,
}));
jest.mock('@/components/common/Toast/Toast', () => ({
  useToast: () => ({ showToast }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  queryState = {
    data: { items: [submission], page: 1, limit: 20, hasNextPage: true },
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch,
  };
  mutationState = { mutate, isPending: false };
});
afterEach(cleanup);

function openAndConfirm(action: 'Approve' | 'Reject') {
  fireEvent.click(screen.getByRole('button', { name: 'Review KYC for Asha Rao' }));
  fireEvent.click(screen.getByRole('button', { name: action }));
  fireEvent.click(
    screen.getByRole('button', {
      name: action === 'Approve' ? 'Confirm approval' : 'Confirm rejection',
    }),
  );
}

describe('KYC review queue', () => {
  it('lists pending submissions without exposing document numbers in the table', () => {
    render(<UserApprovalsTable />);
    expect(screen.getByText('Asha Rao')).toBeTruthy();
    expect(screen.getByText('asha@example.com')).toBeTruthy();
    expect(screen.getByText('1.2500 g')).toBeTruthy();
    expect(screen.queryByText('ABCDE1234F')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens the documents for the chosen customer', () => {
    render(<UserApprovalsTable />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Review KYC for Asha Rao' }),
    );
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('ABCDE1234F')).toBeTruthy();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('shows an empty state when nothing is waiting', () => {
    queryState.data = { items: [], page: 1, limit: 20, hasNextPage: false };
    render(<UserApprovalsTable />);
    expect(screen.getByText('No KYC submissions waiting')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('explains an empty page beyond the first', () => {
    const { rerender } = render(<UserApprovalsTable />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    queryState.data = { items: [], page: 2, limit: 20, hasNextPage: false };
    rerender(<UserApprovalsTable />);
    expect(screen.getByText('No submissions on this page')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('retries a failed load without a perpetual loader', () => {
    queryState.data = undefined;
    queryState.isError = true;
    render(<UserApprovalsTable />);
    expect(screen.getByRole('alert').textContent).toContain(
      'KYC queue is unavailable',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('pages and resets to page one when the page size changes', () => {
    render(<UserApprovalsTable />);
    expect(queryMock).toHaveBeenLastCalledWith(1, 20);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(queryMock).toHaveBeenLastCalledWith(2, 20);
    fireEvent.change(screen.getByRole('combobox', { name: 'Rows per page' }), {
      target: { value: '50' },
    });
    expect(queryMock).toHaveBeenLastCalledWith(1, 50);
  });

  it('sends the approval for the reviewed customer and toasts on success', () => {
    render(<UserApprovalsTable />);
    openAndConfirm('Approve');
    expect(mutate).toHaveBeenCalledTimes(1);
    const [payload, options] = mutate.mock.calls[0];
    expect(payload).toEqual({ userId: 'customer-1', kycStatus: 'verified' });

    act(() => options.onSuccess?.());
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'KYC approved', variant: 'success' }),
    );
  });

  it('sends the rejection for the reviewed customer', () => {
    render(<UserApprovalsTable />);
    openAndConfirm('Reject');
    expect(mutate.mock.calls[0][0]).toEqual({
      userId: 'customer-1',
      kycStatus: 'rejected',
    });
  });

  it('keeps the dialog open with the error when the request fails', () => {
    render(<UserApprovalsTable />);
    openAndConfirm('Approve');
    const { onError } = mutate.mock.calls[0][1];

    act(() =>
      onError?.({ status: 500, code: 'ERR', message: 'Server exploded' }),
    );
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain(
      'The server is having trouble right now',
    );
    expect(showToast).not.toHaveBeenCalled();
  });

  it.each([403, 404])(
    'closes the dialog and explains when the customer is gone (%i)',
    (status) => {
      render(<UserApprovalsTable />);
      openAndConfirm('Approve');
      const { onError } = mutate.mock.calls[0][1];

      act(() =>
        onError?.({ status, code: 'ERR', message: 'user not found in tenant' }),
      );
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Customer unavailable',
          variant: 'danger',
        }),
      );
    },
  );

  it('ignores a second decision while one is already in flight', () => {
    mutationState.isPending = true;
    mutationState.variables = { userId: 'customer-1', kycStatus: 'verified' };
    render(<UserApprovalsTable />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Review KYC for Asha Rao' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Confirm approval' }),
    );
    expect(mutate).not.toHaveBeenCalled();
  });
});

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { stubMatchMedia } from '@/components/vault/Redemptions/testUtils';
import { StoreLedgerPanel } from './StoreLedgerPanel';

const mockUseStoreLedger = jest.fn();
const mockRefetch = jest.fn();
const mockMutate = jest.fn();
const mockShowToast = jest.fn();
let mockReverseState: { isPending: boolean };

jest.mock('@/features/admin/hooks/useReverseLedgerEntry', () => ({
  useReverseLedgerEntry: () => ({ ...mockReverseState, mutate: mockMutate }),
}));
jest.mock('@/components/common/Toast/Toast', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

jest.mock('@/features/admin/hooks/useStoreLedger', () => ({
  useStoreLedger: (page: number, limit: number) =>
    mockUseStoreLedger(page, limit),
}));

const entry = {
  id: 'ledger-purchase',
  eventType: 'GOLD_PURCHASE',
  paymentMode: 'COUNTER_CASH',
  weightGrams: 1.25,
  amountInr: 10000.5,
  runningGoldBalanceGrams: 3.75,
  timestamp: '2026-01-02T00:00:00.000Z',
  isReversed: false,
};

const loadedQuery = {
  data: { items: [entry], page: 1, limit: 20, hasNextPage: true },
  isLoading: false,
  isError: false,
  isFetching: false,
  refetch: mockRefetch,
};

beforeEach(() => {
  stubMatchMedia();
  mockUseStoreLedger.mockReset();
  mockRefetch.mockReset();
  mockMutate.mockReset();
  mockShowToast.mockReset();
  mockReverseState = { isPending: false };
  mockUseStoreLedger.mockReturnValue(loadedQuery);
});

afterEach(cleanup);

describe('StoreLedgerPanel', () => {
  it('requests pages of 20 and lets the user return from an empty final page', () => {
    mockUseStoreLedger.mockImplementation((page: number) => ({
      ...loadedQuery,
      data: {
        ...loadedQuery.data,
        page,
        items: page === 1 ? [entry] : [],
        hasNextPage: page === 1,
      },
    }));
    render(<StoreLedgerPanel />);

    expect(
      (screen.getByRole('button', { name: 'Previous' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(mockUseStoreLedger).toHaveBeenLastCalledWith(2, 20);
    expect(
      screen.getByText('You’ve reached the end of the ledger'),
    ).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(mockUseStoreLedger).toHaveBeenLastCalledWith(1, 20);
    expect(screen.getByText('ledger-purchase')).toBeTruthy();
  });

  it('offers a retry on request failure and keeps failed pages navigable', () => {
    mockUseStoreLedger.mockImplementation((page: number) =>
      page === 1
        ? loadedQuery
        : {
            ...loadedQuery,
            data: undefined,
            isError: true,
          },
    );
    render(<StoreLedgerPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByRole('alert').textContent).toContain(
      'Couldn’t load the store ledger',
    );
    expect(
      (screen.getByRole('button', { name: 'Previous' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    expect(
      (screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('shows a loading state and prevents pagination while a request is active', () => {
    mockUseStoreLedger.mockReturnValue({
      ...loadedQuery,
      isLoading: true,
      isFetching: true,
    });
    render(<StoreLedgerPanel />);

    expect(
      screen.getByRole('status', { name: 'Loading store ledger' }),
    ).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('explains an empty first page without leaving a perpetual loader', () => {
    mockUseStoreLedger.mockReturnValue({
      ...loadedQuery,
      data: { ...loadedQuery.data, items: [], hasNextPage: false },
    });
    render(<StoreLedgerPanel />);

    expect(screen.getByText('No transactions yet')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
    expect(
      (screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  describe('reversing an entry', () => {
    function openDialog() {
      render(<StoreLedgerPanel />);
      fireEvent.click(
        screen.getByRole('button', {
          name: 'Reverse ledger entry ledger-purchase',
        }),
      );
      return screen.getByRole('dialog');
    }

    it('asks for confirmation and does not call the API until confirmed', () => {
      const dialog = openDialog();

      expect(
        within(dialog).getByText('Reverse this ledger entry?'),
      ).toBeTruthy();
      expect(within(dialog).getByText('ledger-purchase')).toBeTruthy();
      expect(mockMutate).not.toHaveBeenCalled();

      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      expect(mockMutate).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('reverses the entry, closes the dialog and confirms with a toast', () => {
      mockMutate.mockImplementation((_id, options) => options.onSuccess());
      const dialog = openDialog();

      fireEvent.click(
        within(dialog).getByRole('button', { name: 'Reverse entry' }),
      );

      expect(mockMutate.mock.calls[0][0]).toBe('ledger-purchase');
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'success' }),
      );
    });

    it('closes the dialog and explains a 409 conflict', () => {
      mockMutate.mockImplementation((_id, options) =>
        options.onError({
          status: 409,
          code: 'ERROR_LEDGER_REVERSAL',
          message: 'Redemption is no longer pending.',
        }),
      );
      const dialog = openDialog();

      fireEvent.click(
        within(dialog).getByRole('button', { name: 'Reverse entry' }),
      );

      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.queryByRole('alert')).toBeNull();
      expect(mockShowToast).toHaveBeenCalledWith({
        title: 'Entry can’t be reversed',
        description: 'Redemption is no longer pending. The ledger has been refreshed.',
        variant: 'danger',
      });
    });

    it('keeps the dialog open when the customer no longer holds the gold', () => {
      mockMutate.mockImplementation((_id, options) =>
        options.onError({
          status: 400,
          code: 'ERROR_INSUFFICIENT_BALANCE',
          message: 'Insufficient gold balance for this transaction.',
        }),
      );
      const dialog = openDialog();

      fireEvent.click(
        within(dialog).getByRole('button', { name: 'Reverse entry' }),
      );

      expect(screen.getByRole('dialog')).toBeTruthy();
      expect(within(dialog).getByRole('alert').textContent).toBe(
        'Insufficient gold balance for this transaction.',
      );
      expect(mockShowToast).not.toHaveBeenCalled();
    });

    it('cannot be dismissed while the request is pending', () => {
      mockReverseState = { isPending: true };
      const dialog = openDialog();

      expect(
        (
          within(dialog).getByRole('button', {
            name: 'Cancel',
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(true);
      fireEvent.keyDown(dialog, { key: 'Escape' });
      expect(screen.getByRole('dialog')).toBeTruthy();
    });

    it('explains a 404 by refreshing instead of retrying', () => {
      mockMutate.mockImplementation((_id, options) =>
        options.onError({
          status: 404,
          code: 'ERROR_LEDGER_NOT_FOUND',
          message: 'Transaction not found.',
        }),
      );
      const dialog = openDialog();

      fireEvent.click(
        within(dialog).getByRole('button', { name: 'Reverse entry' }),
      );

      expect(screen.queryByRole('dialog')).toBeNull();
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'danger' }),
      );
    });

    it('does not offer reversal for reversed entries', () => {
      mockUseStoreLedger.mockReturnValue({
        ...loadedQuery,
        data: { ...loadedQuery.data, items: [{ ...entry, isReversed: true }] },
      });
      render(<StoreLedgerPanel />);

      expect(
        (
          screen.getByRole('button', {
            name: 'Reverse ledger entry ledger-purchase',
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(true);
    });
  });
});

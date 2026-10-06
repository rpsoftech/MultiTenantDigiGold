import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StoreLedgerPanel } from './StoreLedgerPanel';

const mockUseStoreLedger = jest.fn();
const mockRefetch = jest.fn();

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
  mockUseStoreLedger.mockReset();
  mockRefetch.mockReset();
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
});

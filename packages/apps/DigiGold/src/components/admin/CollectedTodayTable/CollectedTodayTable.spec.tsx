import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { cleanup, render, screen } from '@testing-library/react';
import type {
  CollectedRedemption,
  StorePage,
} from '@/features/admin/admin.types';
import { CollectedTodayTable } from './CollectedTodayTable';

jest.mock('@/hooks/useMediaQuery', () => ({ useMediaQuery: () => true }));

const handover: CollectedRedemption = {
  id: 'rdm-9',
  weightGrams: 1.5,
  requestedAt: '2026-10-09T05:00:00Z',
  // 10:30 IST
  collectedAt: '2026-10-09T05:00:00Z',
  customerName: 'Asha Rao',
  customerPhone: '9876543210',
  collectedBy: 'counter.staff',
};

let queryState: {
  data?: StorePage<CollectedRedemption>;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  refetch: () => void;
};
const queryMock = jest.fn();

jest.mock('@/features/admin/hooks/useCollectedRedemptions', () => ({
  useCollectedRedemptions: (page: number, limit: number) => {
    queryMock(page, limit);
    return queryState;
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  queryState = {
    data: { items: [handover], page: 1, limit: 20, hasNextPage: false },
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: jest.fn(),
  };
});
afterEach(cleanup);

describe('CollectedTodayTable', () => {
  it('lists each handover with the time in IST and who handed it over', () => {
    render(<CollectedTodayTable />);

    expect(
      screen.getByRole('heading', { name: 'Collected today' }),
    ).toBeTruthy();
    expect(screen.getByText('Asha Rao')).toBeTruthy();
    expect(screen.getByText('1.5000 g')).toBeTruthy();
    expect(screen.getByText(/10:30/)).toBeTruthy();
    expect(screen.getByText('counter.staff')).toBeTruthy();
    expect(queryMock).toHaveBeenCalledWith(1, 20);
  });

  it('says when nothing has been handed over yet', () => {
    queryState.data = { items: [], page: 1, limit: 20, hasNextPage: false };
    render(<CollectedTodayTable />);

    expect(screen.getByText('Nothing handed over yet today')).toBeTruthy();
  });
});

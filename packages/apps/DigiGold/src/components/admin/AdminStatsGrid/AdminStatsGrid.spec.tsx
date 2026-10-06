import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AdminStatsGrid } from './AdminStatsGrid';

const mockRefetch = jest.fn();
let mockQuery: {
  data?: {
    totalVolumeGrams: number;
    totalRevenueInr: number;
    totalMarginEarned: number;
    totalTransactions: number;
  };
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  refetch: typeof mockRefetch;
};

jest.mock('@/features/admin/hooks/useAdminStats', () => ({
  useAdminStats: () => mockQuery,
}));

afterEach(cleanup);
beforeEach(() => {
  mockRefetch.mockReset();
  mockQuery = {
    data: {
      totalVolumeGrams: 12.3456,
      totalRevenueInr: 96000.25,
      totalMarginEarned: 1920.5,
      totalTransactions: 24,
    },
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: mockRefetch,
  };
});

it('renders all four store analytics without unsupported vault or period claims', () => {
  render(<AdminStatsGrid />);
  expect(screen.getByText('12.3456 g')).toBeTruthy();
  expect(screen.getByText('₹96,000.25')).toBeTruthy();
  expect(screen.getByText('₹1,920.50')).toBeTruthy();
  expect(screen.getByText('24')).toBeTruthy();
  expect(screen.queryByText('Total Vaulted Gold')).toBeNull();
  expect(screen.queryByText('Registered Users')).toBeNull();
});

it('renders valid zero totals as data instead of a loading state', () => {
  mockQuery.data = {
    totalVolumeGrams: 0,
    totalRevenueInr: 0,
    totalMarginEarned: 0,
    totalTransactions: 0,
  };
  render(<AdminStatsGrid />);
  expect(screen.getByText('0.0000 g')).toBeTruthy();
  expect(screen.getAllByText('₹0.00')).toHaveLength(2);
  expect(screen.queryByRole('status')).toBeNull();
});

it('allows retry after an analytics request fails', () => {
  mockQuery.data = undefined;
  mockQuery.isError = true;
  render(<AdminStatsGrid />);
  expect(screen.getByRole('alert')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Retry analytics' }));
  expect(mockRefetch).toHaveBeenCalledTimes(1);
});

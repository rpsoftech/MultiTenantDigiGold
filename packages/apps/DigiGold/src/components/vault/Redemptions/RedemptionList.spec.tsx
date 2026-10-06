import { fireEvent, screen, waitFor } from '@testing-library/react';
import {
  installMatchMedia,
  renderWithProviders,
} from '@/test-utils/renderWithProviders';
import { redemptionService } from '@/features/redemption/redemption.service';
import type { Redemption } from '@/features/redemption/redemption.types';
import { RedemptionList } from './RedemptionList';

jest.mock('@/features/redemption/redemption.service', () => ({
  redemptionService: { create: jest.fn(), list: jest.fn(), cancel: jest.fn() },
}));

const mockedService = redemptionService as jest.Mocked<
  typeof redemptionService
>;

function makeRedemption(
  index: number,
  status: Redemption['status'] = 'PENDING',
): Redemption {
  return {
    redemption_uuid: `r-${index}`,
    weight_grams: index,
    status,
    pickup_code: String(100000 + index),
    created_at: '2026-10-01T10:00:00Z',
  };
}

function page(items: Redemption[], pageNumber = 1) {
  return { success: true, data: items, page: pageNumber, limit: 20 };
}

describe('RedemptionList', () => {
  beforeAll(() => installMatchMedia());
  beforeEach(() => jest.clearAllMocks());

  it('shows a loader while the list loads', () => {
    mockedService.list.mockReturnValue(new Promise<never>(() => undefined));
    renderWithProviders(<RedemptionList />);

    expect(
      screen.getByRole('status', { name: 'Loading redemptions' }),
    ).toBeTruthy();
  });

  it('shows an empty state when there are no redemptions', async () => {
    mockedService.list.mockResolvedValue(page([]));
    renderWithProviders(<RedemptionList />);

    expect(await screen.findByText('No redemptions yet.')).toBeTruthy();
  });

  it('renders each redemption with its status', async () => {
    mockedService.list.mockResolvedValue(
      page([
        makeRedemption(1),
        makeRedemption(2, 'COLLECTED'),
        makeRedemption(3, 'CANCELLED'),
      ]),
    );
    renderWithProviders(<RedemptionList />);

    expect(await screen.findByText('Pending')).toBeTruthy();
    expect(screen.getByText('Collected')).toBeTruthy();
    expect(screen.getByText('Cancelled')).toBeTruthy();
    // Only the pending item offers a cancel action.
    expect(
      screen.getAllByRole('button', { name: 'Cancel redemption' }),
    ).toHaveLength(1);
  });

  it('offers a retry after a load failure', async () => {
    mockedService.list.mockRejectedValueOnce({ message: 'down', status: 500 });
    renderWithProviders(<RedemptionList />);
    expect(
      await screen.findByText(/couldn.t load your redemptions/i),
    ).toBeTruthy();

    mockedService.list.mockResolvedValueOnce(page([makeRedemption(1)]));
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Pending')).toBeTruthy();
  });

  it('loads more pages on demand', async () => {
    const firstPage = Array.from({ length: 20 }, (_, index) =>
      makeRedemption(index + 1),
    );
    mockedService.list.mockResolvedValueOnce(page(firstPage));
    renderWithProviders(<RedemptionList />);
    const loadMore = await screen.findByRole('button', { name: 'Load more' });

    mockedService.list.mockResolvedValueOnce(
      page([makeRedemption(21, 'COLLECTED')], 2),
    );
    fireEvent.click(loadMore);

    await waitFor(() => expect(screen.getByText('Collected')).toBeTruthy());
    expect(mockedService.list.mock.calls[1][0]).toEqual({ page: 2, limit: 20 });
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  });

  it('does not offer load more when the first page is short', async () => {
    mockedService.list.mockResolvedValue(page([makeRedemption(1)]));
    renderWithProviders(<RedemptionList />);

    await screen.findByText('Pending');
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  });
});

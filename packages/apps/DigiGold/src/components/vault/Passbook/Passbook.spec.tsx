import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/renderWithProviders';
import { tradeService } from '@/features/trade/trade.service';
import type {
  TradeEventType,
  TradeHistoryEntry,
} from '@/features/trade/trade.types';
import { Passbook } from './Passbook';

// Passbook is gated on a signed-in session (useSessionGate), which redirects with the router.
const replace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace }),
}));
jest.mock('@/features/trade/trade.service', () => ({
  tradeService: { initiateBuy: jest.fn(), getHistory: jest.fn() },
}));

const mockedTrade = tradeService as jest.Mocked<typeof tradeService>;

function makeEntry(
  index: number,
  type: TradeEventType = 'GOLD_PURCHASE',
): TradeHistoryEntry {
  return {
    gl_uuid: `gl-${index}`,
    event_type: type,
    payment_mode: 'ONLINE_PG',
    weight_grams: index,
    total_amount_inr: index * 7000,
    running_gold_balance_grams: index,
    final_rate_per_gram: 7000,
    reference_id: `ref-${index}`,
    created_at: '2026-10-01T10:00:00Z',
  };
}

const page = (entries: TradeHistoryEntry[], pageNumber = 1) => ({
  success: true,
  data: entries,
  page: pageNumber,
  limit: 20,
});

// jsdom has no IntersectionObserver; capture the callback so tests can scroll the sentinel.
type ObserverCallback = (entries: Array<{ isIntersecting: boolean }>) => void;
let observerCallback: ObserverCallback | null = null;
const disconnect = jest.fn();

describe('Passbook', () => {
  beforeAll(() => {
    class FakeIntersectionObserver {
      constructor(callback: ObserverCallback) {
        observerCallback = callback;
      }
      observe = jest.fn();
      unobserve = jest.fn();
      disconnect = disconnect;
    }
    Object.defineProperty(window, 'IntersectionObserver', {
      writable: true,
      configurable: true,
      value: FakeIntersectionObserver,
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    observerCallback = null;
  });

  it('sends a visitor without a session to login and never loads the history', async () => {
    renderWithProviders(<Passbook />, { user: null });

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    expect(mockedTrade.getHistory).not.toHaveBeenCalled();
  });

  it('shows a loader while the history loads', () => {
    mockedTrade.getHistory.mockReturnValue(
      new Promise(() => undefined) as never,
    );
    renderWithProviders(<Passbook />);

    expect(screen.getByRole('heading', { name: 'Passbook' })).toBeTruthy();
    expect(
      screen.getByRole('status', { name: 'Loading passbook' }),
    ).toBeTruthy();
  });

  it('shows an empty state when nothing has been recorded', async () => {
    mockedTrade.getHistory.mockResolvedValue(page([]));
    renderWithProviders(<Passbook />);

    expect(
      await screen.findByText('No transactions recorded yet.'),
    ).toBeTruthy();
  });

  it('shows an error when the history cannot be loaded', async () => {
    mockedTrade.getHistory.mockRejectedValue({ status: 500, message: 'down' });
    renderWithProviders(<Passbook />);

    expect(
      await screen.findByText(/couldn.t load your passbook/i),
    ).toBeTruthy();
  });

  it('lists every transaction', async () => {
    mockedTrade.getHistory.mockResolvedValue(
      page([
        makeEntry(1),
        makeEntry(2, 'PHYSICAL_REDEMPTION'),
        makeEntry(3, 'SYSTEM_REVERSAL'),
      ]),
    );
    renderWithProviders(<Passbook />);

    expect(await screen.findByText('Gold Purchase')).toBeTruthy();
    expect(screen.getByText('Physical Redemption')).toBeTruthy();
    expect(screen.getByText('System Reversal')).toBeTruthy();
  });

  describe('filters', () => {
    const entries = [
      makeEntry(1, 'GOLD_PURCHASE'),
      makeEntry(2, 'PHYSICAL_REDEMPTION'),
      makeEntry(3, 'SYSTEM_REVERSAL'),
    ];

    it('offers one chip per event type plus All', async () => {
      mockedTrade.getHistory.mockResolvedValue(page(entries));
      renderWithProviders(<Passbook />);
      await screen.findByText('Gold Purchase');

      for (const label of [
        'All',
        'Purchases',
        'Redemptions',
        'Reversals',
        'Adjustments',
      ]) {
        expect(screen.getByRole('button', { name: label })).toBeTruthy();
      }
    });

    it('narrows the list to the chosen type', async () => {
      mockedTrade.getHistory.mockResolvedValue(page(entries));
      renderWithProviders(<Passbook />);
      await screen.findByText('Gold Purchase');

      fireEvent.click(screen.getByRole('button', { name: 'Redemptions' }));

      expect(screen.getByText('Physical Redemption')).toBeTruthy();
      expect(screen.queryByText('Gold Purchase')).toBeNull();
      expect(screen.queryByText('System Reversal')).toBeNull();
    });

    it('goes back to everything with All', async () => {
      mockedTrade.getHistory.mockResolvedValue(page(entries));
      renderWithProviders(<Passbook />);
      await screen.findByText('Gold Purchase');
      fireEvent.click(screen.getByRole('button', { name: 'Reversals' }));

      fireEvent.click(screen.getByRole('button', { name: 'All' }));

      expect(screen.getByText('Gold Purchase')).toBeTruthy();
      expect(screen.getByText('Physical Redemption')).toBeTruthy();
    });

    it('says so when no loaded entry matches the filter', async () => {
      mockedTrade.getHistory.mockResolvedValue(page(entries));
      renderWithProviders(<Passbook />);
      await screen.findByText('Gold Purchase');

      fireEvent.click(screen.getByRole('button', { name: 'Adjustments' }));

      expect(screen.getByText('No entries match this filter.')).toBeTruthy();
    });
  });

  describe('paging', () => {
    const fullPage = () =>
      Array.from({ length: 20 }, (_, index) => makeEntry(index + 1));

    it('offers Load more while pages are full and loads the next one', async () => {
      mockedTrade.getHistory.mockResolvedValueOnce(page(fullPage()));
      renderWithProviders(<Passbook />);
      const loadMore = await screen.findByRole('button', { name: 'Load more' });

      mockedTrade.getHistory.mockResolvedValueOnce(
        page([makeEntry(99, 'SYSTEM_REVERSAL')], 2),
      );
      fireEvent.click(loadMore);

      expect(await screen.findByText('System Reversal')).toBeTruthy();
      expect(mockedTrade.getHistory.mock.calls[1][0]).toEqual({
        page: 2,
        limit: 20,
      });
      expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
    });

    it('does not offer Load more after a short page', async () => {
      mockedTrade.getHistory.mockResolvedValue(page([makeEntry(1)]));
      renderWithProviders(<Passbook />);

      await screen.findByText('Gold Purchase');
      expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
    });

    it('loads the next page by itself when the end of the list scrolls into view', async () => {
      mockedTrade.getHistory.mockResolvedValueOnce(page(fullPage()));
      renderWithProviders(<Passbook />);
      await screen.findByRole('button', { name: 'Load more' });
      expect(observerCallback).not.toBeNull();

      mockedTrade.getHistory.mockResolvedValueOnce(page([makeEntry(99)], 2));
      await act(async () => {
        observerCallback?.([{ isIntersecting: true }]);
      });

      await waitFor(() =>
        expect(mockedTrade.getHistory).toHaveBeenCalledTimes(2),
      );
    });

    it('does not load more when the end of the list is not in view', async () => {
      mockedTrade.getHistory.mockResolvedValueOnce(page(fullPage()));
      renderWithProviders(<Passbook />);
      await screen.findByRole('button', { name: 'Load more' });

      act(() => {
        observerCallback?.([{ isIntersecting: false }]);
      });

      expect(mockedTrade.getHistory).toHaveBeenCalledTimes(1);
    });

    it('stops watching the list when it goes away', async () => {
      mockedTrade.getHistory.mockResolvedValueOnce(page(fullPage()));
      const { unmount } = renderWithProviders(<Passbook />);
      await screen.findByRole('button', { name: 'Load more' });

      unmount();

      expect(disconnect).toHaveBeenCalled();
    });
  });
});

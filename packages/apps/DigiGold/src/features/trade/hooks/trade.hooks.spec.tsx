import { act, waitFor } from '@testing-library/react';
import { renderHookWithProviders } from '@/test-utils/renderWithProviders';
import { tradeService } from '../trade.service';
import type { TradeHistoryEntry } from '../trade.types';
import { useBuySettlement } from './useBuySettlement';
import { useInitiateBuy } from './useInitiateBuy';
import { useTradeHistory } from './useTradeHistory';

jest.mock('../trade.service', () => ({
  tradeService: { initiateBuy: jest.fn(), getHistory: jest.fn() },
}));

const mockedService = tradeService as jest.Mocked<typeof tradeService>;

function makeEntry(
  overrides: Partial<TradeHistoryEntry> = {},
): TradeHistoryEntry {
  return {
    gl_uuid: 'gl-1',
    event_type: 'GOLD_PURCHASE',
    payment_mode: 'ONLINE_PG',
    weight_grams: 1,
    total_amount_inr: 7000,
    running_gold_balance_grams: 1,
    final_rate_per_gram: 7000,
    created_at: '2026-10-01T10:00:00Z',
    ...overrides,
  };
}

function historyPage(entries: TradeHistoryEntry[], page = 1) {
  return { success: true, data: entries, page, limit: 20 };
}

describe('useInitiateBuy', () => {
  beforeEach(() => jest.clearAllMocks());

  it('locks a quote for the requested amount', async () => {
    const quote = {
      success: true,
      order_id: 'order_1',
      amount: 7000,
      weight_grams: 1,
      final_rate_per_gram: 7000,
      quote_expires_at: 1790762400, // unix seconds, as MainServer sends TradeQuote.ExpiresAt
    };
    mockedService.initiateBuy.mockResolvedValue(quote);
    const { result } = renderHookWithProviders(() => useInitiateBuy());
    const payload = { total_amount_inr: 7000, requested_rate_per_gram: 7000 };

    let response: unknown;
    await act(async () => {
      response = await result.current.mutateAsync(payload);
    });

    expect(mockedService.initiateBuy.mock.calls[0][0]).toEqual(payload);
    expect(response).toEqual(quote);
  });

  it('reports a rejected buy', async () => {
    mockedService.initiateBuy.mockRejectedValue({
      status: 403,
      message: 'KYC required',
    });
    const { result } = renderHookWithProviders(() => useInitiateBuy());

    await act(async () => {
      await result.current
        .mutateAsync({ total_amount_inr: 70000, requested_rate_per_gram: 7000 })
        .catch(() => undefined);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useTradeHistory', () => {
  beforeEach(() => jest.clearAllMocks());

  it('flattens pages and keeps offering the next page while pages are full', async () => {
    const fullPage = Array.from({ length: 20 }, (_, index) =>
      makeEntry({ gl_uuid: `gl-${index}` }),
    );
    mockedService.getHistory.mockResolvedValueOnce(historyPage(fullPage));
    const { result } = renderHookWithProviders(() => useTradeHistory());

    await waitFor(() => expect(result.current.entries).toHaveLength(20));
    expect(mockedService.getHistory).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
    });
    expect(result.current.hasNextPage).toBe(true);

    mockedService.getHistory.mockResolvedValueOnce(
      historyPage([makeEntry({ gl_uuid: 'last' })], 2),
    );
    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.entries).toHaveLength(21));
    expect(mockedService.getHistory).toHaveBeenLastCalledWith({
      page: 2,
      limit: 20,
    });
    expect(result.current.hasNextPage).toBe(false);
  });

  it('has no next page after a short first page', async () => {
    mockedService.getHistory.mockResolvedValueOnce(historyPage([makeEntry()]));
    const { result } = renderHookWithProviders(() => useTradeHistory());

    await waitFor(() => expect(result.current.entries).toHaveLength(1));
    expect(result.current.hasNextPage).toBe(false);
  });

  it('returns no entries before the first response', () => {
    mockedService.getHistory.mockReturnValue(
      new Promise(() => undefined) as never,
    );
    const { result } = renderHookWithProviders(() => useTradeHistory());

    expect(result.current.entries).toEqual([]);
    expect(result.current.isLoading).toBe(true);
  });
});

describe('useBuySettlement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  const advance = (ms: number) =>
    act(async () => {
      await jest.advanceTimersByTimeAsync(ms);
    });

  it('is idle and silent without a payment id', () => {
    const { result } = renderHookWithProviders(() => useBuySettlement(null));

    expect(result.current.status).toBe('idle');
    expect(result.current.entry).toBeUndefined();
    expect(mockedService.getHistory).not.toHaveBeenCalled();
  });

  it('polls the latest history while the credit has not appeared', async () => {
    mockedService.getHistory.mockResolvedValue(
      historyPage([makeEntry({ reference_id: 'other' })]),
    );
    const { result } = renderHookWithProviders(() => useBuySettlement('pay_1'));

    await advance(0);
    expect(result.current.status).toBe('polling');
    expect(mockedService.getHistory).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
    });
    const firstCalls = mockedService.getHistory.mock.calls.length;

    await advance(3000);
    expect(mockedService.getHistory.mock.calls.length).toBeGreaterThan(
      firstCalls,
    );
    expect(result.current.status).toBe('polling');
  });

  it('settles with the matching ledger entry and stops polling', async () => {
    const credited = makeEntry({
      gl_uuid: 'gl-credit',
      reference_id: 'pay_1',
      weight_grams: 0.5,
    });
    mockedService.getHistory
      .mockResolvedValueOnce(
        historyPage([makeEntry({ reference_id: 'other' })]),
      )
      .mockResolvedValue(historyPage([credited]));
    const { result } = renderHookWithProviders(() => useBuySettlement('pay_1'));

    await advance(0);
    expect(result.current.status).toBe('polling');

    // One poll interval, then a moment for the refetched data to flush to the hook.
    await advance(3000);
    await advance(100);
    expect(result.current.status).toBe('settled');
    expect(result.current.entry?.gl_uuid).toBe('gl-credit');

    const callsAtSettle = mockedService.getHistory.mock.calls.length;
    await advance(10000);
    expect(mockedService.getHistory.mock.calls.length).toBe(callsAtSettle);
  });

  it('gives up after 40 seconds without a credit', async () => {
    mockedService.getHistory.mockResolvedValue(historyPage([]));
    const { result } = renderHookWithProviders(() => useBuySettlement('pay_1'));

    await advance(0);
    expect(result.current.status).toBe('polling');

    await advance(40000);
    expect(result.current.status).toBe('timeout');

    const callsAtTimeout = mockedService.getHistory.mock.calls.length;
    await advance(10000);
    expect(mockedService.getHistory.mock.calls.length).toBe(callsAtTimeout);
  });

  it('goes back to idle when the payment id is cleared', async () => {
    mockedService.getHistory.mockResolvedValue(historyPage([]));
    const { result, rerender } = renderHookWithProviders(
      ({ id }: { id: string | null }) => useBuySettlement(id),
      { initialProps: { id: 'pay_1' as string | null } },
    );
    await advance(0);
    expect(result.current.status).toBe('polling');

    rerender({ id: null });

    expect(result.current.status).toBe('idle');
  });
});

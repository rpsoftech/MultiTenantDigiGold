import { act, waitFor } from '@testing-library/react';
import { renderHookWithProviders } from '@/test-utils/renderWithProviders';
import { marketService } from '../market.service';
import { subscribeToLiveRate, type LiveRateListener } from '../market.sse';
import type { MarketRate } from '../market.types';
import { useLiveRate } from './useLiveRate';

jest.mock('../market.service', () => ({
  marketService: { getLastRate: jest.fn() },
}));
jest.mock('../market.sse', () => ({
  subscribeToLiveRate: jest.fn(),
}));

const mockedService = marketService as jest.Mocked<typeof marketService>;
const mockedSubscribe = subscribeToLiveRate as jest.MockedFunction<typeof subscribeToLiveRate>;

const rate = (price: number): MarketRate => ({
  pricePerGramInr: price,
  mcxBaseRateInr: price - 313,
  marginAppliedInr: 100,
  gstAppliedInr: 213,
  purityLabel: '24K',
  updatedAt: '2026-10-01T10:00:00Z',
});

describe('useLiveRate', () => {
  let listener: LiveRateListener;
  const unsubscribe = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockedSubscribe.mockImplementation((next) => {
      listener = next;
      return unsubscribe;
    });
    mockedService.getLastRate.mockResolvedValue(rate(7000));
  });

  it('loads the last known rate so there is a price before the first tick', async () => {
    const { result } = renderHookWithProviders(() => useLiveRate());
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.data?.pricePerGramInr).toBe(7000));
    expect(result.current.isLoading).toBe(false);
  });

  it('skips the one-off fetch when the store already holds a rate', () => {
    const { result } = renderHookWithProviders(() => useLiveRate(), {
      preloaded: { market: { current: rate(7100), previous: null, status: 'open' } },
    });

    expect(mockedService.getLastRate).not.toHaveBeenCalled();
    expect(result.current.data?.pricePerGramInr).toBe(7100);
    expect(result.current.isLoading).toBe(false);
  });

  it('follows live ticks from the stream', async () => {
    const { result } = renderHookWithProviders(() => useLiveRate());
    await waitFor(() => expect(result.current.data).not.toBeNull());

    act(() => listener.onTick(rate(7250)));

    expect(result.current.data?.pricePerGramInr).toBe(7250);
  });

  it('reports whether the stream is connected', async () => {
    const { result } = renderHookWithProviders(() => useLiveRate());
    expect(result.current.isConnected).toBe(false);

    act(() => listener.onStatusChange('open'));
    expect(result.current.isConnected).toBe(true);
    expect(result.current.status).toBe('open');

    act(() => listener.onStatusChange('error'));
    expect(result.current.isConnected).toBe(false);
  });

  it('subscribes once and unsubscribes when unmounted', () => {
    const { unmount } = renderHookWithProviders(() => useLiveRate());
    expect(mockedSubscribe).toHaveBeenCalledTimes(1);

    unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('stays without a rate when the server has none yet', async () => {
    mockedService.getLastRate.mockResolvedValue(null);
    const { result } = renderHookWithProviders(() => useLiveRate());

    await waitFor(() => expect(mockedService.getLastRate).toHaveBeenCalled());
    expect(result.current.data).toBeNull();
  });
});

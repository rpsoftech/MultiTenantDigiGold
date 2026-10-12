import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { act, cleanup, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { useSession } from '@/features/auth/hooks/useSession';
import type { NormalizedApiError } from '@/lib/api/client';
import { portfolioService, shouldUseMockPortfolio } from '../portfolio.service';
import type { Portfolio } from '../portfolio.types';
import { usePortfolio } from './usePortfolio';

jest.mock('@/features/auth/hooks/useSession', () => ({
  useSession: jest.fn(),
}));
jest.mock('../portfolio.service', () => ({
  portfolioService: { getPortfolio: jest.fn() },
  shouldUseMockPortfolio: jest.fn(),
}));

const PORTFOLIO: Portfolio = {
  balanceGrams: 2,
  currentValuationInr: 14000,
  liveRate: { bid: 7000, ask: 7100, lastHigh: null, lastLow: null },
  fetchedAt: '2026-09-27T10:00:00.000Z',
};
const NETWORK_ERROR: NormalizedApiError = {
  code: 'ERR_NETWORK',
  message: 'Network Error',
  status: null,
};
const getPortfolio = jest.mocked(portfolioService.getPortfolio);
let queryClient: QueryClient;

function renderPortfolio() {
  return renderHook(() => usePortfolio(), {
    wrapper: ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
}

async function advanceTime(ms = 1) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  getPortfolio.mockReset();
  jest.mocked(shouldUseMockPortfolio).mockReturnValue(false);
  jest
    .mocked(useSession)
    .mockReturnValue({ user: null, isAuthenticated: true, sessionRevision: 1 });
  queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity } },
  });
});

afterEach(() => {
  cleanup();
  queryClient.clear();
  jest.useRealTimers();
});

describe('usePortfolio', () => {
  it.each([null, 400, 401, 403, 404])(
    'surfaces a failure with status %s without automatic retries',
    async (status) => {
      getPortfolio.mockRejectedValue({ ...NETWORK_ERROR, status });
      const { result } = renderPortfolio();

      expect(result.current.isLoading).toBe(true);
      await advanceTime();

      expect(result.current.isLoading).toBe(false);
      expect(result.current.isError).toBe(true);
      expect(result.current.error).toBeTruthy();
      await advanceTime(5_000);
      expect(getPortfolio).toHaveBeenCalledTimes(1);
    },
  );

  it('retries a server failure only once before surfacing it', async () => {
    getPortfolio.mockRejectedValue({ ...NETWORK_ERROR, status: 503 });
    const { result } = renderPortfolio();
    await advanceTime();

    expect(getPortfolio).toHaveBeenCalledTimes(1);
    expect(result.current.isLoading).toBe(true);
    await advanceTime(1_001);

    expect(getPortfolio).toHaveBeenCalledTimes(2);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toMatch(/server is having trouble/i);
    await advanceTime(5_000);
    expect(getPortfolio).toHaveBeenCalledTimes(2);
  });

  it.each(['manual retry', 'scheduled poll'])(
    'keeps the actionable error visible during a %s, then clears it on success',
    async (trigger) => {
      let resolveRetry!: (portfolio: Portfolio) => void;
      getPortfolio.mockRejectedValueOnce(NETWORK_ERROR).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveRetry = resolve;
          }),
      );
      const { result } = renderPortfolio();
      await advanceTime();
      const failureMessage = result.current.error;
      expect(failureMessage).toMatch(/can't reach the server/i);

      if (trigger === 'manual retry') {
        act(() => {
          void result.current.refetch();
        });
        await advanceTime();
      } else {
        await advanceTime(30_000);
      }

      expect(getPortfolio).toHaveBeenCalledTimes(2);
      expect(result.current.isFetching).toBe(true);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isError).toBe(true);
      expect(result.current.error).toBe(failureMessage);

      await act(async () => {
        resolveRetry(PORTFOLIO);
        await jest.advanceTimersByTimeAsync(1);
      });

      expect(result.current.portfolio).toEqual(PORTFOLIO);
      expect(result.current.isFetching).toBe(false);
      expect(result.current.isError).toBe(false);
      expect(result.current.error).toBeNull();
    },
  );

  it('keeps the last successful holdings when a background request fails', async () => {
    getPortfolio
      .mockResolvedValueOnce(PORTFOLIO)
      .mockRejectedValueOnce(NETWORK_ERROR);
    const { result } = renderPortfolio();
    await advanceTime();
    expect(result.current.portfolio).toEqual(PORTFOLIO);

    await advanceTime(30_000);

    expect(getPortfolio).toHaveBeenCalledTimes(2);
    expect(result.current.portfolio).toEqual(PORTFOLIO);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(true);
  });

  it('does not request private holdings for a signed-out visitor', async () => {
    jest
      .mocked(useSession)
      .mockReturnValue({
        user: null,
        isAuthenticated: false,
        sessionRevision: 1,
      });
    const { result } = renderPortfolio();
    await advanceTime(30_000);

    expect(getPortfolio).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  it('hides cached holdings on sign-out', async () => {
    getPortfolio.mockResolvedValue(PORTFOLIO);
    const { result, rerender } = renderPortfolio();
    await advanceTime();
    expect(result.current.portfolio).toEqual(PORTFOLIO);

    jest.mocked(useSession).mockReturnValue({
      user: null,
      isAuthenticated: false,
      sessionRevision: 1,
    });
    rerender();

    expect(result.current.portfolio).toBeNull();
    await advanceTime(30_000);
    expect(getPortfolio).toHaveBeenCalledTimes(1);
  });

  it('never shows the previous customer holdings during a new sign-in or failed fetch', async () => {
    let rejectSecondCustomer!: (reason: unknown) => void;
    getPortfolio.mockResolvedValueOnce(PORTFOLIO).mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectSecondCustomer = reject;
        }),
    );
    const { result, rerender } = renderPortfolio();
    await advanceTime();
    expect(result.current.portfolio).toEqual(PORTFOLIO);

    jest.mocked(useSession).mockReturnValue({
      user: null,
      isAuthenticated: true,
      sessionRevision: 2,
    });
    rerender();

    expect(result.current.portfolio).toBeNull();
    expect(result.current.isLoading).toBe(true);
    await act(async () => {
      rejectSecondCustomer(NETWORK_ERROR);
      await jest.advanceTimersByTimeAsync(1);
    });
    expect(result.current.portfolio).toBeNull();
    expect(result.current.error).toMatch(/can't reach the server/i);
  });

  it.each(['initial request', 'background refresh'])(
    'requires sign-in and stops polling after a 401 from the %s',
    async (phase) => {
      if (phase === 'background refresh')
        getPortfolio.mockResolvedValueOnce(PORTFOLIO);
      getPortfolio.mockRejectedValue({ ...NETWORK_ERROR, status: 401 });
      const { result, rerender } = renderPortfolio();
      await advanceTime();
      if (phase === 'background refresh') {
        expect(result.current.portfolio).toEqual(PORTFOLIO);
        await advanceTime(30_000);
      }

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.portfolio).toBeNull();
      expect(result.current.error).toMatch(/sign in again/i);
      const requestsAfterRejection = getPortfolio.mock.calls.length;
      await advanceTime(90_000);
      expect(getPortfolio).toHaveBeenCalledTimes(requestsAfterRejection);

      getPortfolio.mockResolvedValue(PORTFOLIO);
      jest.mocked(useSession).mockReturnValue({
        user: null,
        isAuthenticated: true,
        sessionRevision: 2,
      });
      rerender();
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.portfolio).toBeNull();
      expect(result.current.error).toBeNull();
      await advanceTime();
      expect(result.current.portfolio).toEqual(PORTFOLIO);
    },
  );

  it('loads mock holdings after sign-in and keeps them out of the live cache', async () => {
    jest.mocked(shouldUseMockPortfolio).mockReturnValue(true);
    jest
      .mocked(useSession)
      .mockReturnValue({
        user: null,
        isAuthenticated: false,
        sessionRevision: 1,
      });
    getPortfolio.mockResolvedValue(PORTFOLIO);
    const { result, rerender } = renderPortfolio();
    await advanceTime();

    expect(getPortfolio).not.toHaveBeenCalled();
    expect(result.current.portfolio).toBeNull();

    jest
      .mocked(useSession)
      .mockReturnValue({
        user: null,
        isAuthenticated: true,
        sessionRevision: 1,
      });
    rerender();
    await advanceTime();

    expect(result.current.portfolio).toEqual(PORTFOLIO);
    expect(result.current.isMock).toBe(true);
    expect(result.current.isAuthenticated).toBe(true);
    expect(getPortfolio).toHaveBeenCalledTimes(1);

    jest.mocked(shouldUseMockPortfolio).mockReturnValue(false);
    jest
      .mocked(useSession)
      .mockReturnValue({
        user: null,
        isAuthenticated: false,
        sessionRevision: 1,
      });
    rerender();
    await advanceTime();

    expect(result.current.portfolio).toBeNull();
    expect(result.current.isMock).toBe(false);
    expect(getPortfolio).toHaveBeenCalledTimes(1);
  });
});

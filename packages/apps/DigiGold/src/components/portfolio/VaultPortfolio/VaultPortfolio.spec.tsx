import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/client';
import { makeStore, type AppStore } from '@/store';
import { sessionEstablished } from '@/store/session/session.slice';
import { useLiveRate } from '@/features/market/hooks/useLiveRate';
import type { MarketRate } from '@/features/market/market.types';
import { VaultPortfolio } from './VaultPortfolio';

// The vault reads only the raw bid/ask sides and updatedAt; BuySellGold's margin/GST
// breakdown fields are required by MarketRate but irrelevant here.
const UNUSED_PURCHASE_PRICING = { mcxBaseRateInr: 0, marginAppliedInr: 0, gstAppliedInr: 0 };

jest.mock('next/navigation', () => ({ useRouter: jest.fn() }));
jest.mock('@/features/market/hooks/useLiveRate', () => ({
  useLiveRate: jest.fn(),
}));

const originalMockFlag = process.env.NEXT_PUBLIC_USE_MOCK_PORTFOLIO;
let queryClient: QueryClient;
let store: AppStore;
const push = jest.fn();

beforeEach(() => {
  process.env.NEXT_PUBLIC_USE_MOCK_PORTFOLIO = 'false';
  queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity } },
  });
  store = makeStore();
  setMarketRate(null, false);
  jest.mocked(useRouter).mockReturnValue({
    push,
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  });
});

afterEach(() => {
  cleanup();
  queryClient.clear();
  jest.restoreAllMocks();
  push.mockClear();
  if (originalMockFlag === undefined)
    delete process.env.NEXT_PUBLIC_USE_MOCK_PORTFOLIO;
  else process.env.NEXT_PUBLIC_USE_MOCK_PORTFOLIO = originalMockFlag;
});

function signIn() {
  store.dispatch(
    sessionEstablished({
      userId: 'customer-uuid',
      role: 'customer',
      isNewUser: false,
      kycStatus: 'not_started',
    }),
  );
}

function vaultElement() {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <VaultPortfolio />
      </QueryClientProvider>
    </Provider>
  );
}

function renderVault() {
  return render(vaultElement());
}

function setMarketRate(data: MarketRate | null, connected: boolean) {
  jest.mocked(useLiveRate).mockReturnValue({
    data,
    isConnected: connected,
    isLoading: false,
    status: connected ? 'open' : 'closed',
  });
}

const portfolioResponse = {
  data: {
    success: true,
    balance_grams: 2,
    current_valuation_inr: 14000,
    live_rate: { bid: 7000, ask: 7100 },
  },
};

describe('vault with real APIs enabled', () => {
  it('shows a sign-in prompt without requesting holdings, then loads API data after sign-in', async () => {
    const get = jest.spyOn(apiClient, 'get').mockResolvedValue({
      data: {
        success: true,
        balance_grams: 2,
        current_valuation_inr: 14000,
        live_rate: { bid: 7000, ask: 7100 },
      },
    });
    renderVault();

    expect(screen.getByText('Your vault is private')).toBeTruthy();
    expect(get).not.toHaveBeenCalled();
    screen.getByRole('button', { name: 'Sign in to view your vault' }).click();
    expect(push).toHaveBeenCalledWith('/login');

    act(signIn);
    await waitFor(() => expect(screen.getByText('2.0000 g')).toBeTruthy());
    expect(get).toHaveBeenCalledWith('/user/portfolio');
    expect(screen.getByText('₹14,000')).toBeTruthy();
    expect(screen.queryByText(/Demo data/)).toBeNull();
    expect(screen.queryByText('Your vault is private')).toBeNull();
  });

  it('shows an API error rather than sample holdings when the server is unavailable', async () => {
    jest.spyOn(apiClient, 'get').mockRejectedValue({
      message: 'Network Error',
      code: 'ERR_NETWORK',
      status: null,
    });
    signIn();
    renderVault();

    await waitFor(() =>
      expect(screen.getByText("We couldn't load your vault")).toBeTruthy(),
    );
    expect(
      screen.getByText(
        "Can't reach the server. Check your connection and try again.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    expect(screen.queryByText('24.5812 g')).toBeNull();
    expect(screen.queryByText(/Demo data/)).toBeNull();
  });

  it('shows a loading state while the first holdings request is pending', async () => {
    let resolveRequest!: (value: typeof portfolioResponse) => void;
    jest.spyOn(apiClient, 'get').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );
    signIn();
    renderVault();

    expect(
      screen.getByRole('status', { name: 'Loading your vault' }),
    ).toBeTruthy();
    await act(async () => {
      resolveRequest(portfolioResponse);
    });
    await waitFor(() => expect(screen.getByText('2.0000 g')).toBeTruthy());
    expect(
      screen.queryByRole('status', { name: 'Loading your vault' }),
    ).toBeNull();
  });

  it('updates bid/ask and their timestamp from the stream without changing the server valuation', async () => {
    jest.spyOn(apiClient, 'get').mockResolvedValue(portfolioResponse);
    signIn();
    const view = renderVault();
    await waitFor(() => expect(screen.getByText('₹14,000')).toBeTruthy());
    expect(screen.getByText('Snapshot')).toBeTruthy();
    const updatedAt = new Date(Date.now() + 1000).toISOString();
    const quote: MarketRate = {
      pricePerGramInr: 7250,
      ...UNUSED_PURCHASE_PRICING,
      bidPerGramInr: 7200,
      askPerGramInr: 7250,
      purityLabel: '24K',
      updatedAt,
    };
    setMarketRate(quote, true);
    view.rerender(vaultElement());

    expect(screen.getByText(/₹7,200.00/)).toBeTruthy();
    expect(screen.getByText(/₹7,250.00/)).toBeTruthy();
    expect(screen.getByText('₹14,000')).toBeTruthy();
    expect(screen.getByText('Live')).toBeTruthy();
    expect(
      screen.getByText(/Rates updated/).querySelector('time')?.dateTime,
    ).toBe(updatedAt);

    // A dropped stream keeps its last received prices, explicitly marked as a snapshot.
    setMarketRate(quote, false);
    view.rerender(vaultElement());
    expect(screen.getByText(/₹7,200.00/)).toBeTruthy();
    expect(screen.getByText('Snapshot')).toBeTruthy();
    expect(screen.queryByText('Live')).toBeNull();
  });

  it('does not call an old cached quote or an unquoted open stream live', async () => {
    jest.spyOn(apiClient, 'get').mockResolvedValue(portfolioResponse);
    setMarketRate(
      {
        pricePerGramInr: 6000,
        ...UNUSED_PURCHASE_PRICING,
        bidPerGramInr: 5900,
        askPerGramInr: 6000,
        purityLabel: '24K',
        updatedAt: '2020-01-01T00:00:00.000Z',
      },
      true,
    );
    signIn();
    const view = renderVault();
    await waitFor(() => expect(screen.getByText('₹14,000')).toBeTruthy());
    expect(screen.getByText(/₹7,000.00/)).toBeTruthy();
    expect(screen.queryByText(/₹5,900.00/)).toBeNull();
    expect(screen.getByText('Snapshot')).toBeTruthy();

    setMarketRate(null, true);
    view.rerender(vaultElement());
    expect(screen.getByText('Snapshot')).toBeTruthy();
  });

  it('does not combine a missing live bid with an older snapshot bid', async () => {
    jest.spyOn(apiClient, 'get').mockResolvedValue(portfolioResponse);
    signIn();
    const view = renderVault();
    await waitFor(() => expect(screen.getByText('₹14,000')).toBeTruthy());
    setMarketRate(
      {
        pricePerGramInr: 7250,
        ...UNUSED_PURCHASE_PRICING,
        bidPerGramInr: null,
        askPerGramInr: 7250,
        purityLabel: '24K',
        updatedAt: new Date(Date.now() + 1000).toISOString(),
      },
      true,
    );
    view.rerender(vaultElement());

    expect(screen.getByText('Unavailable')).toBeTruthy();
    expect(screen.getByText(/₹7,250.00/)).toBeTruthy();
    expect(screen.queryByText(/₹7,000.00/)).toBeNull();
    expect(screen.queryByText('Spread')).toBeNull();
    expect(screen.getByText('₹14,000')).toBeTruthy();
  });

  it('keeps simulated holdings and prices separate from a connected real market stream', async () => {
    process.env.NEXT_PUBLIC_USE_MOCK_PORTFOLIO = 'true';
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const get = jest.spyOn(apiClient, 'get');
    setMarketRate(
      {
        pricePerGramInr: 7250,
        ...UNUSED_PURCHASE_PRICING,
        bidPerGramInr: 7200,
        askPerGramInr: 7250,
        purityLabel: '24K',
        updatedAt: new Date(Date.now() + 1000).toISOString(),
      },
      true,
    );
    signIn();
    renderVault();
    await waitFor(() => expect(screen.getByText('24.5812 g')).toBeTruthy());

    expect(screen.getByText(/Demo data/)).toBeTruthy();
    expect(screen.getByText(/₹7,120.83/)).toBeTruthy();
    expect(screen.queryByText(/₹7,200.00/)).toBeNull();
    expect(screen.getByText('Snapshot')).toBeTruthy();
    expect(get).not.toHaveBeenCalled();
  });

  it('retains holdings with a visible refresh failure and recovers using retry', async () => {
    jest
      .spyOn(apiClient, 'get')
      .mockResolvedValueOnce(portfolioResponse)
      .mockRejectedValueOnce({
        message: 'Network Error',
        code: 'ERR_NETWORK',
        status: null,
      })
      .mockResolvedValueOnce(portfolioResponse);
    signIn();
    renderVault();
    await waitFor(() => expect(screen.getByText('₹14,000')).toBeTruthy());
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['portfolio'] });
    });

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.getByText('₹14,000')).toBeTruthy();
    expect(screen.getByText(/Holdings updated/)).toBeTruthy();
    screen.getByRole('button', { name: 'Retry portfolio refresh' }).click();
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  it('removes stale private holdings and offers sign-in after a background 401', async () => {
    jest
      .spyOn(apiClient, 'get')
      .mockResolvedValueOnce(portfolioResponse)
      .mockRejectedValueOnce({
        message: 'Unauthorized',
        code: 'ERR_BAD_REQUEST',
        status: 401,
      });
    signIn();
    renderVault();
    await waitFor(() => expect(screen.getByText('₹14,000')).toBeTruthy());
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['portfolio'] });
    });

    await waitFor(() =>
      expect(screen.getByText('Your vault is private')).toBeTruthy(),
    );
    expect(screen.queryByText('₹14,000')).toBeNull();
    screen.getByRole('button', { name: 'Sign in to view your vault' }).click();
    expect(push).toHaveBeenCalledWith('/login');
  });

  it("does not show another customer's cached holdings after changing sessions", async () => {
    let rejectSecondRequest!: (reason: unknown) => void;
    jest
      .spyOn(apiClient, 'get')
      .mockResolvedValueOnce(portfolioResponse)
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectSecondRequest = reject;
          }),
      );
    store.dispatch(
      sessionEstablished({
        userId: '',
        mobileNumber: '9000000001',
        role: 'customer',
        isNewUser: false,
        kycStatus: 'not_started',
      }),
    );
    renderVault();
    await waitFor(() => expect(screen.getByText('₹14,000')).toBeTruthy());
    act(() => {
      store.dispatch(
        sessionEstablished({
          userId: '',
          mobileNumber: '9000000002',
          role: 'customer',
          isNewUser: false,
          kycStatus: 'not_started',
        }),
      );
    });

    expect(screen.queryByText('₹14,000')).toBeNull();
    expect(screen.queryByText('2.0000 g')).toBeNull();
    expect(
      screen.getByRole('status', { name: 'Loading your vault' }),
    ).toBeTruthy();
    await act(async () => {
      rejectSecondRequest({
        message: 'Network Error',
        code: 'ERR_NETWORK',
        status: null,
      });
    });
    await waitFor(() =>
      expect(screen.getByText("We couldn't load your vault")).toBeTruthy(),
    );
    expect(screen.queryByText('₹14,000')).toBeNull();
  });
});

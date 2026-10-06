import { afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { usePortfolio } from '@/features/portfolio/hooks/usePortfolio';
import { DEFAULT_TENANT_CONFIG } from '@/features/tenant/tenant.defaults';
import { makeStore, type AppStore } from '@/store';
import { registrationStarted, sessionEstablished } from '@/store/session/session.slice';
import { Redemptions } from './Redemptions';
import { stubMatchMedia, withProviders } from './testUtils';

jest.mock('next/navigation', () => ({ useRouter: jest.fn() }));
jest.mock('@/components/common/Toast/Toast', () => ({ useToast: () => ({ showToast: jest.fn() }) }));
jest.mock('@/features/portfolio/hooks/usePortfolio', () => ({
  usePortfolio: jest.fn(),
  PORTFOLIO_QUERY_KEY: ['portfolio'],
}));
jest.mock('./RedemptionList', () => ({ RedemptionList: () => null }));

const replace = jest.fn();
let store: AppStore;

function setPortfolio(isMock: boolean) {
  jest.mocked(usePortfolio).mockReturnValue({
    portfolio: {
      balanceGrams: 24.5812,
      currentValuationInr: 175000,
      liveRate: { bid: 7120, ask: 7137, lastHigh: null, lastLow: null },
      fetchedAt: '2026-10-04T10:00:00Z',
    },
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
    isAuthenticated: true,
    isMock,
    refetch: jest.fn(),
  } as unknown as ReturnType<typeof usePortfolio>);
}

// A portfolio request that is still loading, or that failed, as usePortfolio reports it.
function setPortfolioState(state: { isLoading?: boolean; isError?: boolean }) {
  const refetch = jest.fn();
  jest.mocked(usePortfolio).mockReturnValue({
    portfolio: null,
    isLoading: state.isLoading ?? false,
    isFetching: false,
    isError: state.isError ?? false,
    error: state.isError ? { message: 'down', code: 'ERR_BAD_RESPONSE', status: 503 } : null,
    isAuthenticated: true,
    isMock: false,
    refetch,
  } as unknown as ReturnType<typeof usePortfolio>);
  return refetch;
}

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

beforeAll(stubMatchMedia);
beforeEach(() => {
  jest.clearAllMocks();
  store = makeStore();
  setPortfolio(false);
  jest.mocked(useRouter).mockReturnValue({
    push: jest.fn(),
    replace,
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  });
});
afterEach(cleanup);

describe('Redemptions page', () => {
  it('offers the redeem form against the real balance', () => {
    signIn();
    render(withProviders(<Redemptions />, store));
    expect(screen.getByText('24.5812 g')).toBeTruthy();
    expect(screen.getByLabelText('Weight to redeem (grams)')).toBeTruthy();
  });

  it('keeps a page-level heading', () => {
    signIn();
    render(withProviders(<Redemptions />, store));
    expect(screen.getByRole('heading', { level: 1, name: 'Redeem gold' })).toBeTruthy();
  });

  it('withholds the form while the vault shows demo data', () => {
    signIn();
    setPortfolio(true);
    render(withProviders(<Redemptions />, store));
    expect(screen.getByText(/unavailable while the vault shows demo data/)).toBeTruthy();
    expect(screen.queryByLabelText('Weight to redeem (grams)')).toBeNull();
  });

  it('explains a disabled vault module', () => {
    store = makeStore({
      tenant: {
        config: {
          ...DEFAULT_TENANT_CONFIG,
          activeModules: { ...DEFAULT_TENANT_CONFIG.activeModules, vault: false },
        },
      },
    });
    signIn();
    render(withProviders(<Redemptions />, store));
    expect(screen.getByText("The vault isn't available here")).toBeTruthy();
    expect(screen.queryByLabelText('Weight to redeem (grams)')).toBeNull();
  });

  it('sends a half-registered visitor (no access token) to login', () => {
    store.dispatch(registrationStarted({ token: 'registration-token', phone: '9999900001' }));
    render(withProviders(<Redemptions />, store));
    expect(replace).toHaveBeenCalledWith('/login');
    expect(screen.queryByLabelText('Weight to redeem (grams)')).toBeNull();
  });

  it('shows a loader, not the form, while the vault balance loads', () => {
    signIn();
    setPortfolioState({ isLoading: true });
    render(withProviders(<Redemptions />, store));
    expect(screen.getByRole('status', { name: 'Loading your vault' })).toBeTruthy();
    expect(screen.queryByLabelText('Weight to redeem (grams)')).toBeNull();
  });

  it('offers a retry when the balance fails to load', () => {
    signIn();
    const refetch = setPortfolioState({ isError: true });
    render(withProviders(<Redemptions />, store));
    expect(screen.getByText("Couldn't load your vault balance.")).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText('Weight to redeem (grams)')).toBeNull();
  });

  it('sends a signed-out visitor to login without showing the form', () => {
    render(withProviders(<Redemptions />, store));
    expect(replace).toHaveBeenCalledWith('/login');
    expect(screen.queryByLabelText('Weight to redeem (grams)')).toBeNull();
  });
});

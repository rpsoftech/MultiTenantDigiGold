import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useLiveRate } from '@/features/market/hooks/useLiveRate';
import { useToast } from '@/components/common/Toast/Toast';
import { makeStore, type AppStore } from '@/store';
import { sessionEstablished } from '@/store/session/session.slice';
import { applyDefaultTenantPricing } from '@/features/market/tenantPricing';
import { BuySellGold } from './BuySellGold';

jest.mock('next/navigation', () => ({ useRouter: jest.fn() }));
jest.mock('@/features/market/hooks/useLiveRate', () => ({
  useLiveRate: jest.fn(),
}));
jest.mock('@/components/common/Toast/Toast', () => ({ useToast: jest.fn() }));

const push = jest.fn();
const showToast = jest.fn();
let store: AppStore;
let queryClient: QueryClient;

// `price` is the purchase price shown to the customer, i.e. after the margin/GST estimate.
// The fixture carries matching breakdown fields so the summary rows stay consistent.
function rateFor(price: number) {
  const breakdown = applyDefaultTenantPricing(price);
  return {
    pricePerGramInr: price,
    mcxBaseRateInr: breakdown.mcxBaseRateInr,
    marginAppliedInr: breakdown.marginAppliedInr,
    gstAppliedInr: breakdown.gstAppliedInr,
    bidPerGramInr: null,
    askPerGramInr: null,
    purityLabel: '24K • 99.99%',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };
}

function setRate(price: number | null, isLoading = false) {
  jest.mocked(useLiveRate).mockReturnValue({
    data: price === null ? null : rateFor(price),
    isLoading,
    isConnected: true,
    status: 'open',
  });
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

function buySellGold() {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <BuySellGold />
      </QueryClientProvider>
    </Provider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  store = makeStore();
  queryClient = new QueryClient();
  setRate(null);
  jest.mocked(useRouter).mockReturnValue({
    push,
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  });
  jest.mocked(useToast).mockReturnValue({ showToast });
});

afterEach(cleanup);

describe('purchase calculator rate availability', () => {
  it('shows initial loading without a zero quote or price lock', () => {
    signIn();
    setRate(null, true);
    render(buySellGold());

    expect(
      screen.getByRole('status', { name: 'Loading live rate' }),
    ).toBeTruthy();
    expect(screen.queryByText('Price Locked')).toBeNull();
    expect(screen.queryByText(/₹0/)).toBeNull();
    expect(
      screen.getByRole<HTMLButtonElement>('button', {
        name: 'Waiting for live rate',
      }).disabled,
    ).toBe(true);
  });

  it('shows an unavailable state after an empty snapshot and prevents payment', () => {
    signIn();
    render(buySellGold());

    expect(
      screen.getByText(
        'Live rate is currently unavailable. Waiting for an update.',
      ),
    ).toBeTruthy();
    expect(
      screen.queryByRole('status', { name: 'Loading live rate' }),
    ).toBeNull();
    expect(screen.queryByText('Price Locked')).toBeNull();
    expect(screen.queryByText('Total Investment Amount (est.):')).toBeNull();
    expect(screen.queryByText('GST (est.):')).toBeNull();
    expect(screen.queryByText(/₹0/)).toBeNull();
    const proceed = screen.getByRole<HTMLButtonElement>('button', {
      name: 'Waiting for live rate',
    });
    expect(proceed.disabled).toBe(true);
    fireEvent.click(proceed);
    expect(showToast).not.toHaveBeenCalled();
  });

  it('enables the actual quote when a price arrives and removes it if the rate disappears', () => {
    signIn();
    const view = render(buySellGold());
    setRate(7000);
    view.rerender(buySellGold());

    expect(screen.getByText('₹7,000/g')).toBeTruthy();
    expect(screen.getByText('Total Investment Amount (est.):')).toBeTruthy();
    expect(
      screen.getByRole<HTMLButtonElement>('button', {
        name: 'Proceed to Pay ₹7,000',
      }).disabled,
    ).toBe(false);
    expect(
      screen.queryByText(
        'Live rate is currently unavailable. Waiting for an update.',
      ),
    ).toBeNull();

    setRate(null);
    view.rerender(buySellGold());
    expect(screen.queryByText('Price Locked')).toBeNull();
    expect(screen.queryByText('Total Investment Amount (est.):')).toBeNull();
    expect(
      screen.getByRole<HTMLButtonElement>('button', {
        name: 'Waiting for live rate',
      }).disabled,
    ).toBe(true);
  });

  it('requires sign-in before proceeding when a live price is available', () => {
    setRate(7000);
    render(buySellGold());

    fireEvent.click(screen.getByRole('button', { name: 'Login to Proceed' }));

    expect(push).toHaveBeenCalledWith('/login');
    expect(showToast).not.toHaveBeenCalled();
  });
});

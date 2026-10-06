// Purchase flow of BuyGold: display, entering an amount, locking a quote, Razorpay checkout,
// settlement and failures. Rate availability and the KYC gate are in BuyGold.spec.tsx.
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import {
  customerUser,
  renderWithProviders,
} from '@/test-utils/renderWithProviders';
import { tradeService } from '@/features/trade/trade.service';
import { openRazorpayCheckout, loadRazorpayScript } from '@/lib/payments/razorpay';
import type {
  RazorpayCheckoutOptions,
  RazorpayConstructor,
} from '@/lib/payments/razorpay';
import type { TradeHistoryEntry } from '@/features/trade/trade.types';
import { PORTFOLIO_QUERY_KEY } from '@/features/portfolio/hooks/usePortfolio';
import { BuyGold } from './BuyGold';

const push = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: jest.fn() }),
}));
jest.mock('@/features/trade/trade.service', () => ({
  tradeService: { initiateBuy: jest.fn(), getHistory: jest.fn() },
}));
// These tests cover the purchase flow itself; KYC limits are covered by BuyGold.spec.tsx
// (KYC gate) and BuyGold.kyc.spec.tsx, so the server-sourced status is simply 'verified'.
jest.mock('@/features/kyc/hooks/useKycStatus', () => ({
  KYC_STATUS_QUERY_KEY: ['user', 'kyc'],
  useKycStatus: () => ({
    status: 'verified',
    isError: false,
    isFetching: false,
    refetch: jest.fn(),
  }),
}));
jest.mock('@/lib/payments/razorpay', () => ({
  loadRazorpayScript: jest.fn(),
  openRazorpayCheckout: jest.fn(),
}));

let liveRate: {
  data: Record<string, unknown> | null;
  isLoading: boolean;
};
jest.mock('@/features/market/hooks/useLiveRate', () => ({
  useLiveRate: () => liveRate,
}));

let tenantConfig: Record<string, unknown> | null;
jest.mock('@/features/tenant/hooks/useTenantConfig', () => ({
  useTenantConfig: () => tenantConfig,
}));

let settlement: { status: string; entry?: TradeHistoryEntry };
jest.mock('@/features/trade/hooks/useBuySettlement', () => ({
  useBuySettlement: (paymentId: string | null) =>
    paymentId === null ? { status: 'idle', entry: undefined } : settlement,
}));

const mockedTrade = tradeService as jest.Mocked<typeof tradeService>;
const mockedLoad = loadRazorpayScript as jest.MockedFunction<typeof loadRazorpayScript>;
const mockedOpen = openRazorpayCheckout as jest.MockedFunction<typeof openRazorpayCheckout>;

const PRICE = 7000;
const RATE = {
  pricePerGramInr: PRICE,
  mcxBaseRateInr: 6500,
  marginAppliedInr: 100,
  gstAppliedInr: 200,
  purityLabel: '24K',
};

const quote = (overrides: Record<string, unknown> = {}) => ({
  success: true,
  order_id: 'order_1',
  amount: 7000,
  weight_grams: 1,
  final_rate_per_gram: 7000,
  // Unix seconds, as MainServer sends TradeQuote.ExpiresAt.
  quote_expires_at: Math.floor(Date.now() / 1000) + 5 * 60,
  ...overrides,
});

const gramsInput = () => screen.getByLabelText('Enter Gold Weight (Grams)') as HTMLInputElement;
const inrInput = () => screen.getByLabelText('Enter Amount (₹)') as HTMLInputElement;
const proceed = () => screen.getByRole('button', { name: /Proceed to Pay|Login to Proceed|Locking|Waiting|Confirming/ }) as HTMLButtonElement;

// The options passed to the most recent Razorpay checkout, so tests can play the customer.
function checkoutOptions(): RazorpayCheckoutOptions {
  return mockedOpen.mock.calls[mockedOpen.mock.calls.length - 1][1];
}

async function startPayment() {
  fireEvent.click(proceed());
  await waitFor(() => expect(mockedOpen).toHaveBeenCalled());
}

describe('BuyGold', () => {
  const originalKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

  beforeEach(() => {
    jest.clearAllMocks();
    liveRate = { data: RATE, isLoading: false };
    tenantConfig = {
      displayName: 'Acme Gold',
      activeModules: { trading: true },
      theme: { colors: { primary: '#123456' } },
    };
    settlement = { status: 'polling' };
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID = 'rzp_test_key';
    mockedTrade.initiateBuy.mockResolvedValue(quote());
    mockedLoad.mockResolvedValue(jest.fn() as unknown as RazorpayConstructor);
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    else process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID = originalKey;
  });

  describe('display', () => {
    it('shows the live rate and a one gram default', () => {
      renderWithProviders(<BuyGold />);

      expect(screen.getByRole('heading', { name: 'Buy Gold' })).toBeTruthy();
      expect(screen.getByText(/Live Market Rate/)).toBeTruthy();
      expect(gramsInput().value).toBe('1');
      expect(screen.getByText('24K')).toBeTruthy();
    });

    it('shows a loader while the rate loads and cannot be submitted', () => {
      liveRate = { data: null, isLoading: true };
      renderWithProviders(<BuyGold />);

      expect(screen.getByRole('status', { name: 'Loading live rate' })).toBeTruthy();
      expect(proceed().disabled).toBe(true);
    });

    it('renders nothing when the trading module is switched off for the tenant', () => {
      tenantConfig = { displayName: 'Acme', activeModules: { trading: false }, theme: { colors: {} } };
      const { container } = renderWithProviders(<BuyGold />);

      expect(container.textContent).toBe('');
    });

    it('breaks the estimate into base rate, margin and GST', () => {
      renderWithProviders(<BuyGold />);

      // 1 g at the mocked rate: base 6,500, margin 100, GST 200.
      expect(screen.getByText('₹6,500')).toBeTruthy();
      expect(screen.getByText('₹100')).toBeTruthy();
      expect(screen.getByText('₹200')).toBeTruthy();
    });
  });

  describe('entering an amount', () => {
    it('accepts numeric weights and ignores anything else', () => {
      renderWithProviders(<BuyGold />);

      fireEvent.change(gramsInput(), { target: { value: '2.5' } });
      expect(gramsInput().value).toBe('2.5');

      fireEvent.change(gramsInput(), { target: { value: '2.5x' } });
      expect(gramsInput().value).toBe('2.5');
    });

    it('clears the weight', () => {
      renderWithProviders(<BuyGold />);

      fireEvent.click(screen.getByRole('button', { name: 'Clear gold weight' }));

      expect(gramsInput().value).toBe('');
      expect(proceed().disabled).toBe(true);
    });

    it('adds quick amounts of grams to the current weight', () => {
      renderWithProviders(<BuyGold />);

      fireEvent.click(screen.getByRole('button', { name: '+0.5g' }));
      expect(gramsInput().value).toBe('1.5000');

      fireEvent.click(screen.getByRole('button', { name: '+5g' }));
      expect(gramsInput().value).toBe('6.5000');
    });

    it('switches to rupees and mirrors the weight as an amount', () => {
      renderWithProviders(<BuyGold />);

      fireEvent.click(screen.getByRole('button', { name: 'Buy in Rupees (₹)' }));

      expect(inrInput().value).toBe('7000.00');
    });

    it('converts a rupee amount into grams at the live price', () => {
      renderWithProviders(<BuyGold />);
      fireEvent.click(screen.getByRole('button', { name: 'Buy in Rupees (₹)' }));

      fireEvent.change(inrInput(), { target: { value: '14000' } });
      fireEvent.click(screen.getByRole('button', { name: 'Buy in Grams (g)' }));

      expect(gramsInput().value).toBe('2.0000');
    });

    it('adds quick rupee amounts', () => {
      renderWithProviders(<BuyGold />);
      fireEvent.click(screen.getByRole('button', { name: 'Buy in Rupees (₹)' }));

      fireEvent.click(screen.getByRole('button', { name: '+₹1,000' }));

      // The weight is stored to 4 decimals (8000 / 7000 = 1.1429 g), so the amount shown
      // back can drift by a few paise; it must stay within that rounding.
      expect(Math.abs(Number(inrInput().value) - 8000)).toBeLessThan(0.5);
    });

    it('clears the rupee amount', () => {
      renderWithProviders(<BuyGold />);
      fireEvent.click(screen.getByRole('button', { name: 'Buy in Rupees (₹)' }));

      fireEvent.click(screen.getByRole('button', { name: 'Clear amount' }));

      expect(inrInput().value).toBe('');
    });

    it('ignores non-numeric rupee input', () => {
      renderWithProviders(<BuyGold />);
      fireEvent.click(screen.getByRole('button', { name: 'Buy in Rupees (₹)' }));

      fireEvent.change(inrInput(), { target: { value: 'abc' } });

      expect(inrInput().value).toBe('7000.00');
    });
  });

  describe('proceeding', () => {
    it('sends a logged-out visitor to login without starting a payment', () => {
      renderWithProviders(<BuyGold />, { user: null });

      expect(proceed().textContent).toContain('Login to Proceed');
      fireEvent.click(proceed());

      expect(push).toHaveBeenCalledWith('/login');
      expect(mockedTrade.initiateBuy).not.toHaveBeenCalled();
    });

    it('locks a quote for the amount and opens checkout with the order details', async () => {
      renderWithProviders(<BuyGold />, { user: customerUser });
      fireEvent.change(gramsInput(), { target: { value: '2' } });

      await startPayment();

      expect(mockedTrade.initiateBuy.mock.calls[0][0]).toEqual({
        total_amount_inr: 14000,
        requested_rate_per_gram: PRICE,
      });
      const options = checkoutOptions();
      expect(options).toMatchObject({
        key: 'rzp_test_key',
        amount: 700000,
        currency: 'INR',
        order_id: 'order_1',
        name: 'Acme Gold',
        description: '1.0000g gold purchase',
        prefill: { contact: '9999900001' },
        theme: { color: '#123456' },
      });
    });

    it('shows the price lock and a waiting label while payment is open', async () => {
      renderWithProviders(<BuyGold />, { user: customerUser });

      await startPayment();

      expect(screen.getByText(/Price Locked/)).toBeTruthy();
      expect(proceed().textContent).toContain('Waiting for payment');
      expect(proceed().disabled).toBe(true);
    });

    it('moves to confirming once the customer pays', async () => {
      renderWithProviders(<BuyGold />, { user: customerUser });
      await startPayment();

      act(() => {
        checkoutOptions().handler({
          razorpay_payment_id: 'pay_1',
          razorpay_order_id: 'order_1',
          razorpay_signature: 'sig',
        });
      });

      expect(screen.getByText(/confirming your gold credit/i)).toBeTruthy();
      expect(proceed().textContent).toContain('Confirming payment');
    });

    it('credits the gold, refreshes balances and resets the form once settled', async () => {
      const { rerender, queryClient } = renderWithProviders(<BuyGold />, { user: customerUser });
      const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
      fireEvent.change(gramsInput(), { target: { value: '2' } });
      await startPayment();
      act(() => {
        checkoutOptions().handler({
          razorpay_payment_id: 'pay_1',
          razorpay_order_id: 'order_1',
          razorpay_signature: 'sig',
        });
      });

      settlement = {
        status: 'settled',
        entry: {
          gl_uuid: 'gl-1',
          event_type: 'GOLD_PURCHASE',
          payment_mode: 'ONLINE_PG',
          weight_grams: 2,
          total_amount_inr: 14000,
          running_gold_balance_grams: 2,
          final_rate_per_gram: 7000,
          reference_id: 'pay_1',
          created_at: '2026-10-01T10:00:00Z',
        },
      };
      rerender(<BuyGold />);

      expect(await screen.findByText('Gold credited')).toBeTruthy();
      expect(screen.getByText('2.0000g added to your vault.')).toBeTruthy();
      const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
      expect(keys).toEqual(expect.arrayContaining([['trade', 'history'], PORTFOLIO_QUERY_KEY]));
      expect(gramsInput().value).toBe('1');
    });

    it('tells the customer when confirmation is taking long', async () => {
      const { rerender } = renderWithProviders(<BuyGold />, { user: customerUser });
      await startPayment();
      act(() => {
        checkoutOptions().handler({
          razorpay_payment_id: 'pay_1',
          razorpay_order_id: 'order_1',
          razorpay_signature: 'sig',
        });
      });

      settlement = { status: 'timeout' };
      rerender(<BuyGold />);

      expect(await screen.findByText(/Still processing your payment/)).toBeTruthy();
    });

    it('shows a message when the checkout is closed without paying', async () => {
      renderWithProviders(<BuyGold />, { user: customerUser });
      await startPayment();

      act(() => {
        checkoutOptions().modal?.ondismiss?.();
      });

      expect(screen.getByText('Payment was not completed.')).toBeTruthy();
      expect(proceed().disabled).toBe(false);
    });

    it('drops the quote when the price lock runs out', async () => {
      jest.useFakeTimers();
      try {
        mockedTrade.initiateBuy.mockResolvedValue(
          quote({ quote_expires_at: Math.floor(Date.now() / 1000) + 2 }),
        );
        renderWithProviders(<BuyGold />, { user: customerUser });
        await act(async () => {
          fireEvent.click(proceed());
          await jest.advanceTimersByTimeAsync(0);
        });
        expect(screen.getByText(/Price Locked/)).toBeTruthy();

        for (let i = 0; i < 3; i += 1) {
          await act(async () => {
            await jest.advanceTimersByTimeAsync(1000);
          });
        }

        expect(screen.queryByText(/Price Locked/)).toBeNull();
        expect(proceed().disabled).toBe(false);
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('failures', () => {
    it('explains that checkout is not configured and does not open it', async () => {
      delete process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
      renderWithProviders(<BuyGold />, { user: customerUser });

      fireEvent.click(proceed());

      expect(await screen.findByText('Payment unavailable')).toBeTruthy();
      expect(mockedOpen).not.toHaveBeenCalled();
      expect(proceed().disabled).toBe(false);
    });

    it('asks for KYC when the server refuses with 403', async () => {
      mockedTrade.initiateBuy.mockRejectedValue({
        status: 403,
        message: 'KYC Verification is required for trades above 50,000 INR',
      });
      renderWithProviders(<BuyGold />, { user: customerUser });

      fireEvent.click(proceed());

      expect(await screen.findByText('KYC verification required')).toBeTruthy();
      expect(
        screen.getByText('KYC Verification is required for trades above 50,000 INR'),
      ).toBeTruthy();
    });

    it('reports other failures to start the payment', async () => {
      mockedTrade.initiateBuy.mockRejectedValue({ status: 409, message: 'Live rate moved.' });
      renderWithProviders(<BuyGold />, { user: customerUser });

      fireEvent.click(proceed());

      expect(await screen.findByText('Could not start payment')).toBeTruthy();
      expect(screen.getByText('Live rate moved.')).toBeTruthy();
      expect(proceed().disabled).toBe(false);
    });

    it('reports a checkout script that fails to load', async () => {
      mockedLoad.mockRejectedValue(new Error('Failed to load Razorpay checkout script'));
      renderWithProviders(<BuyGold />, { user: customerUser });

      fireEvent.click(proceed());

      expect(await screen.findByText('Could not start payment')).toBeTruthy();
      expect(mockedOpen).not.toHaveBeenCalled();
    });
  });
});

import { fireEvent, screen } from '@testing-library/react';
import {
  customerUser,
  renderWithProviders,
} from '@/test-utils/renderWithProviders';
import type { KycStatus } from '@/store/session/session.types';
import { BuyGold } from './BuyGold';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
}));
jest.mock('@/features/market/hooks/useLiveRate', () => ({
  useLiveRate: () => ({
    data: {
      pricePerGramInr: 7000,
      mcxBaseRateInr: 6500,
      marginAppliedInr: 100,
      gstAppliedInr: 200,
      purityLabel: '24K',
    },
    isLoading: false,
    isConnected: true,
    status: 'open',
  }),
}));
jest.mock('@/features/tenant/hooks/useTenantConfig', () => ({
  useTenantConfig: () => ({ activeModules: { trading: true } }),
}));
jest.mock('@/features/trade/hooks/useInitiateBuy', () => ({
  useInitiateBuy: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));
jest.mock('@/features/trade/hooks/useBuySettlement', () => ({
  useBuySettlement: () => ({ status: 'idle' }),
}));
jest.mock('@/lib/payments/razorpay', () => ({
  loadRazorpayScript: jest.fn(),
  openRazorpayCheckout: jest.fn(),
}));

function renderBuy(kycStatus: KycStatus) {
  return renderWithProviders(<BuyGold />, {
    user: { ...customerUser, kycStatus },
  });
}

// 10 g at the mocked 7,000/g is 70,000, above the 50,000 limit; the default 1 g is not.
function enterGrams(grams: string) {
  fireEvent.change(screen.getByLabelText('Enter Gold Weight (Grams)'), {
    target: { value: grams },
  });
}

describe('BuyGold KYC limit message', () => {
  it('shows no KYC message for purchases under the limit', () => {
    renderBuy('not_started');

    expect(screen.queryByText(/require KYC verification/i)).toBeNull();
  });

  it('links to the KYC page when the limit is exceeded and KYC is not done', () => {
    renderBuy('not_started');

    enterGrams('10');

    expect(screen.getByText(/require KYC verification/i)).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Go to KYC' });
    expect(link.getAttribute('href')).toBe('/kyc');
  });

  it('links to the KYC status page while verification is pending', () => {
    renderBuy('pending');

    enterGrams('10');

    expect(screen.getByText(/Your KYC is under review/i)).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'View KYC status' }).getAttribute('href'),
    ).toBe('/kyc');
  });

  it('links to the KYC page again after a rejection', () => {
    renderBuy('rejected');

    enterGrams('10');

    expect(screen.getByRole('link', { name: 'Go to KYC' })).toBeTruthy();
  });

  it('shows no KYC message for a verified customer, even above the limit', () => {
    renderBuy('verified');

    enterGrams('10');

    expect(screen.queryByText(/require KYC verification/i)).toBeNull();
    expect(screen.queryByRole('link', { name: 'Go to KYC' })).toBeNull();
  });
});

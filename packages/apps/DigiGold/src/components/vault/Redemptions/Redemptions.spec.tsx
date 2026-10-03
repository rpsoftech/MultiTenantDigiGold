import { fireEvent, screen, waitFor } from '@testing-library/react';
import { installMatchMedia, renderWithProviders } from '@/test-utils/renderWithProviders';
import { portfolioService } from '@/features/portfolio/portfolio.service';
import { redemptionService } from '@/features/redemption/redemption.service';
import { Redemptions } from './Redemptions';

const replace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: jest.fn() }),
}));
jest.mock('@/features/portfolio/portfolio.service', () => ({
  portfolioService: { getPortfolio: jest.fn() },
}));
jest.mock('@/features/redemption/redemption.service', () => ({
  redemptionService: { create: jest.fn(), list: jest.fn(), cancel: jest.fn() },
}));

const mockedPortfolio = portfolioService as jest.Mocked<typeof portfolioService>;
const mockedRedemptions = redemptionService as jest.Mocked<typeof redemptionService>;

const portfolio = (balance: number) => ({
  success: true,
  balance_grams: balance,
  current_valuation_inr: 0,
  live_rate: null,
});

describe('Redemptions page', () => {
  beforeAll(() => installMatchMedia());
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRedemptions.list.mockResolvedValue({ success: true, data: [], page: 1, limit: 20 });
  });

  it('shows the redeem panel next to the redemption list once the vault loads', async () => {
    mockedPortfolio.getPortfolio.mockResolvedValue(portfolio(3));
    renderWithProviders(<Redemptions />);

    expect(await screen.findByRole('heading', { name: 'Redeem gold' })).toBeTruthy();
    expect(screen.getByText('3.0000 g')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Your redemptions' })).toBeTruthy();
  });

  it('shows a loader while the vault balance loads', () => {
    mockedPortfolio.getPortfolio.mockReturnValue(new Promise(() => undefined) as never);
    renderWithProviders(<Redemptions />);

    expect(screen.getByRole('status', { name: 'Loading your vault' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Redeem gold' })).toBeNull();
  });

  it('offers a retry when the balance fails to load', async () => {
    mockedPortfolio.getPortfolio.mockRejectedValueOnce({ message: 'down', status: 500 });
    renderWithProviders(<Redemptions />);
    expect(await screen.findByText(/couldn.t load your vault balance/i)).toBeTruthy();

    mockedPortfolio.getPortfolio.mockResolvedValueOnce(portfolio(1));
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('heading', { name: 'Redeem gold' })).toBeTruthy();
  });

  it('sends a visitor without a session to login and never loads the vault', async () => {
    renderWithProviders(<Redemptions />, { user: null });

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    expect(mockedPortfolio.getPortfolio).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: 'Redeem gold' })).toBeNull();
  });
});

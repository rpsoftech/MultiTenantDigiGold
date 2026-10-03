import { waitFor } from '@testing-library/react';
import { renderHookWithProviders } from '@/test-utils/renderWithProviders';
import { portfolioService } from '../portfolio.service';
import { usePortfolio } from './usePortfolio';

jest.mock('../portfolio.service', () => ({
  portfolioService: { getPortfolio: jest.fn() },
}));

const mockedService = portfolioService as jest.Mocked<typeof portfolioService>;

describe('usePortfolio', () => {
  beforeEach(() => jest.clearAllMocks());

  it('loads the portfolio when enabled', async () => {
    mockedService.getPortfolio.mockResolvedValue({
      success: true,
      balance_grams: 4.2,
      current_valuation_inr: 28000,
      live_rate: null,
    });
    const { result } = renderHookWithProviders(() => usePortfolio());

    await waitFor(() => expect(result.current.data?.balance_grams).toBe(4.2));
  });

  it('does not fetch while disabled', () => {
    const { result } = renderHookWithProviders(() => usePortfolio(false));

    expect(mockedService.getPortfolio).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });
});

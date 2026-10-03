import { apiClient } from '@/lib/api/client';
import { portfolioService } from './portfolio.service';

jest.mock('@/lib/api/client', () => ({
  apiClient: { get: jest.fn() },
}));

const mockedClient = apiClient as jest.Mocked<typeof apiClient>;

describe('portfolioService.getPortfolio', () => {
  it('reads the portfolio from /user/portfolio', async () => {
    const body = {
      success: true,
      balance_grams: 3.5,
      current_valuation_inr: 24000,
      live_rate: { bid: 6950, ask: 7000 },
    };
    mockedClient.get.mockResolvedValue({ data: body });

    await expect(portfolioService.getPortfolio()).resolves.toEqual(body);
    expect(mockedClient.get).toHaveBeenCalledWith('/user/portfolio');
  });
});

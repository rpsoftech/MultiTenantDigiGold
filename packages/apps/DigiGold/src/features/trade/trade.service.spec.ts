import { apiClient } from '@/lib/api/client';
import { tradeService } from './trade.service';

jest.mock('@/lib/api/client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
}));

const mockedClient = apiClient as jest.Mocked<typeof apiClient>;

describe('tradeService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('initiates a buy and returns the locked quote', async () => {
    const quote = {
      success: true,
      order_id: 'order_1',
      amount: 7000,
      weight_grams: 1,
      final_rate_per_gram: 7000,
      quote_expires_at: '2026-10-01T10:00:00Z',
    };
    mockedClient.post.mockResolvedValue({ data: quote });

    const payload = { total_amount_inr: 7000, requested_rate_per_gram: 7000 };
    const result = await tradeService.initiateBuy(payload);

    expect(mockedClient.post).toHaveBeenCalledWith(
      '/trade/buy/initiate',
      payload,
    );
    expect(result).toEqual(quote);
  });

  it('lets a rejected buy reach the caller', async () => {
    mockedClient.post.mockRejectedValue({
      status: 403,
      message: 'KYC required',
    });

    await expect(
      tradeService.initiateBuy({
        total_amount_inr: 70000,
        requested_rate_per_gram: 7000,
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('reads trade history with paging params', async () => {
    const body = { success: true, data: [], page: 2, limit: 10 };
    mockedClient.get.mockResolvedValue({ data: body });

    const result = await tradeService.getHistory({ page: 2, limit: 10 });

    expect(mockedClient.get).toHaveBeenCalledWith('/trade/history', {
      params: { page: 2, limit: 10 },
    });
    expect(result).toEqual(body);
  });

  it('reads trade history with no params by default', async () => {
    mockedClient.get.mockResolvedValue({
      data: { success: true, data: [], page: 1, limit: 20 },
    });

    await tradeService.getHistory();

    expect(mockedClient.get).toHaveBeenCalledWith('/trade/history', {
      params: {},
    });
  });
});

import { apiClient } from '@/lib/api/client';
import { redemptionService } from './redemption.service';

jest.mock('@/lib/api/client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
}));

const mockedClient = apiClient as jest.Mocked<typeof apiClient>;

describe('redemptionService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a redemption', async () => {
    mockedClient.post.mockResolvedValue({ data: { success: true } });
    await redemptionService.create({ weight_grams: 2 });
    expect(mockedClient.post).toHaveBeenCalledWith('/trade/redeem', {
      weight_grams: 2,
    });
  });

  it('lists redemptions with paging params', async () => {
    mockedClient.get.mockResolvedValue({ data: { data: [] } });
    await redemptionService.list({ page: 2, limit: 20 });
    expect(mockedClient.get).toHaveBeenCalledWith('/trade/redemptions', {
      params: { page: 2, limit: 20 },
    });
  });

  it('cancels a redemption by uuid', async () => {
    mockedClient.post.mockResolvedValue({ data: { success: true } });
    await redemptionService.cancel('abc-123');
    expect(mockedClient.post).toHaveBeenCalledWith(
      '/trade/redemptions/abc-123/cancel',
    );
  });
});

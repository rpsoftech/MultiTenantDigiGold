import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { apiClient } from '@/lib/api/client';
import type { marketService } from './market.service';

const originalMockFlag = process.env.NEXT_PUBLIC_USE_MOCK_MARKET;

afterEach(() => {
  jest.restoreAllMocks();
  if (originalMockFlag === undefined) {
    delete process.env.NEXT_PUBLIC_USE_MOCK_MARKET;
  } else {
    process.env.NEXT_PUBLIC_USE_MOCK_MARKET = originalMockFlag;
  }
});

describe('mock market rate', () => {
  it('returns a sample last rate without requesting the API', async () => {
    process.env.NEXT_PUBLIC_USE_MOCK_MARKET = 'true';
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    let service!: typeof marketService;
    let client!: typeof apiClient;
    jest.isolateModules(() => {
      service = (
        require('./market.service') as { marketService: typeof marketService }
      ).marketService;
      client = (require('@/lib/api/client') as { apiClient: typeof apiClient })
        .apiClient;
    });
    const getSpy = jest
      .spyOn(client, 'get')
      .mockRejectedValue(new Error('Mock market must not request the API'));

    const rate = await service.getLastRate();

    expect(getSpy).not.toHaveBeenCalled();
    expect(rate).toEqual({
      pricePerGramInr: 7120.83,
      purityLabel: '24K • 99.99%',
      updatedAt: expect.any(String),
    });
    expect(Number.isFinite(Date.parse(rate?.updatedAt ?? ''))).toBe(true);
  });
});

describe('live market rate', () => {
  it.each([
    ['{"last-high":7200,"bid":7000,"ask":7100}', 7100, 7000, 7100],
    ['data: {"bid":7000,"ask":7100}\n\n', 7100, 7000, 7100],
    ['{"ask":7100}', 7100, null, 7100],
    ['{"bid":-1,"ask":7100}', 7100, null, 7100],
    ['7120.83', 7120.83, null, null],
    ['{"last-high":7200,"bid":7000}', null, null, null],
    ['{"bid":7000,"ask":0}', null, null, null],
  ])(
    'parses the backend latest_rate JSON string: %s',
    async (latestRate, expectedPrice, expectedBid, expectedAsk) => {
      process.env.NEXT_PUBLIC_USE_MOCK_MARKET = 'false';
      let service!: typeof marketService;
      let client!: typeof apiClient;
      jest.isolateModules(() => {
        service = (
          require('./market.service') as { marketService: typeof marketService }
        ).marketService;
        client = (
          require('@/lib/api/client') as { apiClient: typeof apiClient }
        ).apiClient;
      });
      const getSpy = jest.spyOn(client, 'get').mockResolvedValue({
        data: { latest_rate: latestRate },
      });

      const rate = await service.getLastRate();

      expect(getSpy).toHaveBeenCalledWith('/rates/last-rate');
      if (expectedPrice === null) {
        expect(rate).toBeNull();
      } else {
        expect(rate).toEqual({
          pricePerGramInr: expectedPrice,
          bidPerGramInr: expectedBid,
          askPerGramInr: expectedAsk,
          purityLabel: '24K • 99.99%',
          updatedAt: expect.any(String),
        });
      }
    },
  );
});

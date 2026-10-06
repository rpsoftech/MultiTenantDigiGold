import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { apiClient } from '@/lib/api/client';
import type { marketplaceService } from './marketplace.service';

const originalMockFlag = process.env.NEXT_PUBLIC_USE_MOCK_MARKETPLACE;

afterEach(() => {
  jest.restoreAllMocks();
  if (originalMockFlag === undefined)
    delete process.env.NEXT_PUBLIC_USE_MOCK_MARKETPLACE;
  else process.env.NEXT_PUBLIC_USE_MOCK_MARKETPLACE = originalMockFlag;
});

describe('live marketplace service', () => {
  it.each([
    {
      method: 'getCategories' as const,
      path: '/marketplace/categories',
      items: [
        {
          id: 'rings',
          label: 'Rings',
          imageUrl: '/rings.jpg',
          imageAlt: 'Rings',
          url: '/marketplace/rings',
        },
      ],
    },
    {
      method: 'getTrendingProducts' as const,
      path: '/marketplace/trending',
      items: [
        {
          id: 'ring-1',
          title: 'Gold ring',
          imageUrl: '/ring.jpg',
          imageAlt: 'Ring',
          price: 5000,
          currency: 'INR',
          isNew: false,
          url: '/marketplace/ring-1',
        },
      ],
    },
  ])(
    'loads $path using the API data envelope',
    async ({ method, path, items }) => {
      process.env.NEXT_PUBLIC_USE_MOCK_MARKETPLACE = 'false';
      let service!: typeof marketplaceService;
      let client!: typeof apiClient;
      jest.isolateModules(() => {
        service = (
          require('./marketplace.service') as {
            marketplaceService: typeof marketplaceService;
          }
        ).marketplaceService;
        client = (
          require('@/lib/api/client') as { apiClient: typeof apiClient }
        ).apiClient;
      });
      const request = jest
        .spyOn(client, 'get')
        .mockResolvedValue({ data: { success: true, data: items } });

      await expect(service[method]()).resolves.toEqual(items);
      expect(request).toHaveBeenCalledWith(path);
    },
  );
});

function loadService(mockMode: boolean) {
  process.env.NEXT_PUBLIC_USE_MOCK_MARKETPLACE = mockMode ? 'true' : 'false';
  let service!: typeof marketplaceService;
  let client!: typeof apiClient;
  jest.isolateModules(() => {
    service = (
      require('./marketplace.service') as {
        marketplaceService: typeof marketplaceService;
      }
    ).marketplaceService;
    client = (require('@/lib/api/client') as { apiClient: typeof apiClient })
      .apiClient;
  });
  return { service, client };
}

describe('marketplace service failures', () => {
  // The dashboard sections show their own error and retry; the service must not hide it.
  it('lets a request failure reach the caller', async () => {
    const { service, client } = loadService(false);
    jest
      .spyOn(client, 'get')
      .mockRejectedValue({
        status: 500,
        code: 'ERR_BAD_RESPONSE',
        message: 'down',
      });

    await expect(service.getCategories()).rejects.toMatchObject({
      status: 500,
    });
  });
});

describe('mock marketplace service', () => {
  it.each(['getCategories', 'getTrendingProducts'] as const)(
    '%s serves sample data without calling the server',
    async (method) => {
      const { service, client } = loadService(true);
      const request = jest
        .spyOn(client, 'get')
        .mockRejectedValue(
          new Error('Mock marketplace must not request the API'),
        );

      const items = await service[method]();

      expect(request).not.toHaveBeenCalled();
      expect(items.length).toBeGreaterThan(0);
      expect(items[0]).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          url: expect.any(String),
        }),
      );
    },
  );
});

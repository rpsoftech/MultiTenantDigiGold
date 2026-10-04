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

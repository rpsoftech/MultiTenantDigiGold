// Marks this file as a module so its helpers do not leak into other specs.
export {};

const CATEGORIES = [
  { id: 'c1', label: 'Rings', imageUrl: '/r.png', imageAlt: 'Rings', url: '/marketplace/rings' },
];
const PRODUCTS = [
  {
    id: 'p1',
    title: 'Necklace',
    imageUrl: '/n.png',
    imageAlt: 'Necklace',
    price: 50000,
    currency: 'INR',
    isNew: true,
    url: '/marketplace/p1',
  },
];

jest.mock('@/lib/api/client', () => ({
  apiClient: { get: jest.fn() },
}));

// The mock-data flag is read once when the module loads, so each case loads it fresh and
// gets the matching fresh copy of the mocked api client.
async function load(mockMode = false) {
  jest.resetModules();
  if (mockMode) process.env.NEXT_PUBLIC_USE_MOCK_MARKETPLACE = 'true';
  else delete process.env.NEXT_PUBLIC_USE_MOCK_MARKETPLACE;

  const { marketplaceService } = await import('./marketplace.service');
  const { apiClient } = await import('@/lib/api/client');
  return { marketplaceService, get: apiClient.get as jest.Mock };
}

describe('marketplaceService', () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_USE_MOCK_MARKETPLACE;
  });

  describe('against the server', () => {
    it('reads trending products from the catalogue endpoint', async () => {
      const { marketplaceService, get } = await load();
      get.mockResolvedValue({ data: { data: PRODUCTS } });

      await expect(marketplaceService.getTrendingProducts()).resolves.toEqual(PRODUCTS);
      expect(get).toHaveBeenCalledWith('/marketplace/trending');
    });

    it('reads categories from the catalogue endpoint', async () => {
      const { marketplaceService, get } = await load();
      get.mockResolvedValue({ data: { data: CATEGORIES } });

      await expect(marketplaceService.getCategories()).resolves.toEqual(CATEGORIES);
      expect(get).toHaveBeenCalledWith('/marketplace/categories');
    });

    it('lets a request failure reach the caller', async () => {
      const { marketplaceService, get } = await load();
      get.mockRejectedValue({ status: 500, message: 'down' });

      await expect(marketplaceService.getCategories()).rejects.toMatchObject({ status: 500 });
    });
  });

  describe('in mock mode', () => {
    it('serves sample trending products without calling the server', async () => {
      const { marketplaceService, get } = await load(true);

      const products = await marketplaceService.getTrendingProducts();

      expect(get).not.toHaveBeenCalled();
      expect(products.length).toBeGreaterThan(0);
      expect(products[0]).toEqual(
        expect.objectContaining({ id: expect.any(String), price: expect.any(Number) }),
      );
    });

    it('serves sample categories without calling the server', async () => {
      const { marketplaceService, get } = await load(true);

      const categories = await marketplaceService.getCategories();

      expect(get).not.toHaveBeenCalled();
      expect(categories.length).toBeGreaterThan(0);
      expect(categories[0]).toEqual(
        expect.objectContaining({ id: expect.any(String), label: expect.any(String) }),
      );
    });
  });
});

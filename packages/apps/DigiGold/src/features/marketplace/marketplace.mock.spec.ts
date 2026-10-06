import { describe, expect, it } from '@jest/globals';
import { JEWELLERY_CATEGORIES } from './marketplace.catalogue';
import {
  mockGetCategoryProducts,
  mockGetProduct,
  mockGetTrendingProducts,
} from './marketplace.mock';

describe('marketplace mock catalogue', () => {
  it('resolves every trending product, which the home page links to', async () => {
    const trending = await mockGetTrendingProducts();
    expect(trending.length).toBeGreaterThan(0);
    for (const item of trending) {
      expect(await mockGetProduct(item.id)).toEqual(item);
    }
  });

  it('returns nothing for an unknown category instead of every product', async () => {
    expect(await mockGetCategoryProducts('no-such-category')).toEqual([]);
  });

  it.each(JEWELLERY_CATEGORIES.map(({ id }) => id))(
    'only returns %s products for the %s category',
    async (categoryId) => {
      const products = await mockGetCategoryProducts(categoryId);
      for (const item of products) {
        expect(item.category.toLowerCase().replace(' ', '-')).toBe(categoryId);
      }
    },
  );

  it('returns null for an unknown product', async () => {
    expect(await mockGetProduct('no-such-design')).toBeNull();
  });
});

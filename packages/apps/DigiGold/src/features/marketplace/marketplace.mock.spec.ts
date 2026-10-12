import fs from 'fs';
import path from 'path';
import { describe, expect, it } from '@jest/globals';
import { JEWELLERY_CATEGORIES } from './marketplace.catalogue';
import type { Product } from './marketplace.types';
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

  // The sample catalogue is what demos and tests show, so it must not contradict itself or
  // claim things sample data can't back.
  describe('sample data honesty', () => {
    async function everyProduct(): Promise<Product[]> {
      const byCategory = await Promise.all(
        JEWELLERY_CATEGORIES.map(({ id }) => mockGetCategoryProducts(id)),
      );
      return [...byCategory.flat(), ...(await mockGetTrendingProducts())];
    }

    it('never claims a certification', async () => {
      for (const item of await everyProduct()) {
        expect(item.isBisHallmarked).toBeUndefined();
      }
    });

    it('never names a purity in the title that the specs contradict', async () => {
      for (const item of await everyProduct()) {
        const titled = item.title.match(/\b(\d+)K\b/);
        if (titled) expect(item.carat).toBe(`${titled[1]}KT Gold`);
      }
    });

    it('titles each design after the category it is listed in', async () => {
      for (const { id, label } of JEWELLERY_CATEGORIES) {
        const words = label.replace(/s$/, '').split(' ');
        for (const item of await mockGetCategoryProducts(id)) {
          for (const word of words) expect(item.title).toContain(word);
        }
      }
    });

    it('uses only photos that exist, or none', async () => {
      const publicDir = path.resolve(__dirname, '../../../public');
      for (const item of await everyProduct()) {
        if (item.imageUrl) {
          expect(fs.existsSync(path.join(publicDir, item.imageUrl))).toBe(true);
        }
      }
    });
  });
});

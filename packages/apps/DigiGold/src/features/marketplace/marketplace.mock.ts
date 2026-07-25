import type { Product } from './marketplace.types';

// MainServer's product catalog endpoint isn't ready yet — swapping to the real call in
// marketplace.service.ts is a one-line change (flip USE_MOCK_MARKETPLACE).
const MOCK_TRENDING_PRODUCTS: Product[] = [
  {
    id: 'heritage-necklace-22k',
    title: '22K Gold Heritage Necklace',
    imageUrl: '/marketplace/heritage-necklace-22k.jpg',
    imageAlt: '22K Gold Heritage Necklace',
    price: 145000,
    currency: 'INR',
    isNew: true,
    url: '/marketplace/jewelry/heritage-necklace-22k',
  },
  {
    id: 'minimalist-bangle-24k',
    title: '24K Gold Minimalist Bangle',
    imageUrl: '/marketplace/minimalist-bangle-24k.jpg',
    imageAlt: '24K Gold Minimalist Bangle',
    price: 85500,
    currency: 'INR',
    isNew: false,
    url: '/marketplace/jewelry/minimalist-bangle-24k',
  },
];

export async function mockGetTrendingProducts(): Promise<Product[]> {
  return MOCK_TRENDING_PRODUCTS;
}

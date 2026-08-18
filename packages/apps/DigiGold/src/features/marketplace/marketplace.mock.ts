import type { Category, Product } from './marketplace.types';

// MainServer's product catalog endpoint isn't ready yet — swapping to the real call in
// marketplace.service.ts is a one-line change (flip USE_MOCK_MARKETPLACE).
const MOCK_TRENDING_PRODUCTS: Product[] = [
  {
    id: 'heritage-necklace-22k',
    title: '22K Gold Heritage Necklace',
    imageUrl: '/marketplace/heritage-necklace-24k.jpg',
    imageAlt: '22K Gold Heritage Necklace',
    price: 145000,
    currency: 'INR',
    isNew: true,
    url: '/marketplace/jewelry/heritage-necklace-22k',
  },
  {
    id: 'minimalist-bangle-24k',
    title: '24K Gold Minimalist Bangle',
    imageUrl: '/marketplace/minimalist-bengal1-24k.jpg',
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

const MOCK_CATEGORIES: Category[] = [
  { id: 'kada', label: 'Kada', imageUrl: '/marketplace/categories/kada.jpg', imageAlt: 'Kada' },
  { id: 'chain', label: 'Chain', imageUrl: '/marketplace/categories/chain.jpg', imageAlt: 'Chain' },
  { id: 'watch', label: 'Watch', imageUrl: '/marketplace/categories/watch.jpg', imageAlt: 'Watch' },
  {
    id: 'tanmaniya',
    label: 'Tanmaniya',
    imageUrl: '/marketplace/categories/tanmaniya.jpg',
    imageAlt: 'Tanmaniya',
  },
  {
    id: 'pendant-set',
    label: 'Pendant Set',
    imageUrl: '/marketplace/categories/pendant-set.jpg',
    imageAlt: 'Pendant Set',
  },
  {
    id: 'necklace',
    label: 'Necklace',
    imageUrl: '/marketplace/categories/necklace.jpg',
    imageAlt: 'Necklace',
  },
  {
    id: 'bangles',
    label: 'Bangles',
    imageUrl: '/marketplace/categories/bangles.jpg',
    imageAlt: 'Bangles',
  },
  { id: 'rings', label: 'Rings', imageUrl: '/marketplace/categories/rings.jpg', imageAlt: 'Rings' },
].map((category) => ({ ...category, url: `/marketplace/category/${category.id}` }));

export async function mockGetCategories(): Promise<Category[]> {
  return MOCK_CATEGORIES;
}

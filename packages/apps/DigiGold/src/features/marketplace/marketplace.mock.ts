import type { Category, Product } from './marketplace.types';

// MainServer's product catalog endpoint isn't ready yet — swapping to the real call in
// marketplace.service.ts is a one-line change (flip USE_MOCK_MARKETPLACE).
const PRODUCT_IMAGE_BY_CATEGORY: Record<string, string> = {
  anklets: '/marketplace/categories/bangles.jpg',
  bangles: '/marketplace/categories/bangles.jpg',
  bracelet: '/marketplace/categories/pendant-set.jpg',
  chain: '/marketplace/categories/chain.jpg',
  'chain-pendant': '/marketplace/categories/tanmaniya.jpg',
  kada: '/marketplace/categories/kada.jpg',
  watch: '/marketplace/categories/watch.jpg',
  tanmaniya: '/marketplace/categories/tanmaniya.jpg',
  'pendant-set': '/marketplace/categories/pendant-set.jpg',
  necklace: '/marketplace/categories/necklace.jpg',
  rings: '/marketplace/categories/rings.jpg',
};

const PRODUCT_DEFAULTS = {
  weight: 24,
  carat: '22KT Gold' as const,
  color: 'Yellow' as const,
  category: 'Bangles',
  designType: 'Dailywear Collection',
  gender: 'Ladies' as const,
  collection: 'Daily Wear Jewellery',
  gifts: 'For Her' as const,
};

const createProduct = (
  category: string,
  index: number,
  title: string,
  price: number,
  overrides: Partial<Product> = {},
): Product => ({
  id: `${category}-design-${index}`,
  code: `${category.slice(0, 3).toUpperCase()}${String(index).padStart(5, '0')}`,
  title,
  imageUrl:
    PRODUCT_IMAGE_BY_CATEGORY[category] ?? PRODUCT_IMAGE_BY_CATEGORY.bangles,
  imageAlt: title,
  price,
  currency: 'INR',
  ...PRODUCT_DEFAULTS,
  category: category
    .replace('-', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase()),
  isNew: index % 3 === 1,
  url: `/jewellery/${category}-design-${index}`,
  ...overrides,
});

const MOCK_TRENDING_PRODUCTS: Product[] = [
  {
    id: 'heritage-necklace-22k',
    code: 'NCK00021',
    title: '22K Gold Heritage Necklace',
    imageUrl: '/marketplace/heritage-necklace-24k.jpg',
    imageAlt: '22K Gold Heritage Necklace',
    price: 145000,
    currency: 'INR',
    ...PRODUCT_DEFAULTS,
    isNew: true,
    url: '/jewellery/heritage-necklace-22k',
  },
  {
    id: 'minimalist-bangle-24k',
    code: 'BNR00001',
    title: '24K Gold Minimalist Bangle',
    imageUrl: '/marketplace/minimalist-bengal1-24k.jpg',
    imageAlt: '24K Gold Minimalist Bangle',
    price: 85500,
    currency: 'INR',
    ...PRODUCT_DEFAULTS,
    isNew: false,
    url: '/jewellery/minimalist-bangle-24k',
  },
];

export async function mockGetTrendingProducts(): Promise<Product[]> {
  return MOCK_TRENDING_PRODUCTS;
}

const MOCK_CATEGORY_PRODUCTS: Product[] = [
  ...[
    ['bangles', 'Pink Crystal Link Bracelet', 394670],
    ['bangles', 'Green Glow Bangle', 357865],
    ['bangles', 'Designer Pattern Bangle', 552446],
    ['bangles', 'Oval Charm Bangle', 301043],
    ['bangles', 'Rose Gold Classic Bangle', 487250],
    ['bangles', 'Honeycomb Diamond Bangle', 689900],
    ['anklets', 'Celestial Gold Anklet', 128500],
    ['bracelet', 'Rose Quartz Link Bracelet', 254600],
    ['chain', 'Fine Gold Rolo Chain', 198750],
    ['chain-pendant', 'Lotus Pendant Chain', 325900],
    ['kada', 'Heritage Gold Kada', 745000],
    ['watch', 'Beaded Gold Watch', 482500],
    ['tanmaniya', 'Blue Stone Tanmaniya', 289900],
    ['pendant-set', 'Floral Pendant Set', 399500],
    ['necklace', 'Classic Bridal Necklace', 899900],
    ['rings', 'Solitaire Halo Ring', 215000],
  ].map(([category, title, price], index) =>
    createProduct(
      category as string,
      index + 1,
      title as string,
      price as number,
      {
        ...(category === 'bangles' && {
          code: [
            'BNR00083',
            'BNR00082',
            'BNR00085',
            'BNR00084',
            'BNR00086',
            'BNR00087',
          ][index],
        }),
        weight: 12 + ((index * 11) % 42),
        color: index % 2 === 0 ? 'Rose' : 'Yellow',
        carat:
          index % 4 === 0
            ? '18KT Gold'
            : index % 3 === 0
              ? '9KT Gold'
              : '22KT Gold',
        designType: [
          'Ball Design',
          'Colour Stone',
          'Dailywear Collection',
          'Flower Collection',
        ][index % 4],
        collection: [
          'Antique Collection',
          'Daily Wear Jewellery',
          'Diamond Jewellery',
          'Festive',
          'Italian Collection',
        ][index % 5],
      },
    ),
  ),
];

export async function mockGetCategoryProducts(
  categoryId: string,
): Promise<Product[]> {
  const products = MOCK_CATEGORY_PRODUCTS.filter(
    (product) =>
      product.category.toLowerCase().replace(' ', '-') === categoryId,
  );
  return products.length > 0 ? products : MOCK_CATEGORY_PRODUCTS;
}

export async function mockGetProduct(
  productId: string,
): Promise<Product | null> {
  return (
    MOCK_CATEGORY_PRODUCTS.find((product) => product.id === productId) ?? null
  );
}

export function mockGetAllProducts(): Product[] {
  return MOCK_CATEGORY_PRODUCTS;
}

const MOCK_CATEGORIES: Category[] = [
  {
    id: 'kada',
    label: 'Kada',
    imageUrl: '/marketplace/categories/kada.jpg',
    imageAlt: 'Kada',
  },
  {
    id: 'chain',
    label: 'Chain',
    imageUrl: '/marketplace/categories/chain.jpg',
    imageAlt: 'Chain',
  },
  {
    id: 'watch',
    label: 'Watch',
    imageUrl: '/marketplace/categories/watch.jpg',
    imageAlt: 'Watch',
  },
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
  {
    id: 'rings',
    label: 'Rings',
    imageUrl: '/marketplace/categories/rings.jpg',
    imageAlt: 'Rings',
  },
].map((category) => ({
  ...category,
  url: `/jewellery/category/${category.id}`,
}));

export async function mockGetCategories(): Promise<Category[]> {
  return MOCK_CATEGORIES;
}

import { render, screen } from '@testing-library/react';
import { useTrendingProducts } from '@/features/marketplace/hooks/useTrendingProducts';
import type { Product } from '@/features/marketplace/marketplace.types';
import { TrendingJewelry } from './TrendingJewelry';
import { ProductCard } from './ProductCard';

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
  ),
}));
jest.mock('@/features/marketplace/hooks/useTrendingProducts', () => ({
  useTrendingProducts: jest.fn(),
}));
jest.mock('./trending-jewelry.config.json', () => ({
  title: 'Trending Jewelry',
  subtitle: 'Fresh from our collection',
  viewAllLabel: 'View all',
  viewAllUrl: '/marketplace/jewelry',
  viewDetailsLabel: 'View details',
  newBadgeLabel: 'New',
}));

const mockedUseProducts = useTrendingProducts as jest.Mock;

const products: Product[] = [
  {
    id: 'p1',
    title: 'Heritage Necklace',
    imageUrl: '/n.png',
    imageAlt: 'A necklace',
    price: 125000,
    currency: 'INR',
    isNew: true,
    url: '/marketplace/p1',
  },
  {
    id: 'p2',
    title: 'Classic Ring',
    imageUrl: '/r.png',
    imageAlt: 'A ring',
    price: 42000,
    currency: 'INR',
    isNew: false,
    url: '/marketplace/p2',
  },
];

describe('TrendingJewelry', () => {
  beforeEach(() => mockedUseProducts.mockReturnValue({ data: products, isLoading: false }));

  it('shows the heading, subtitle and a link to everything', () => {
    render(<TrendingJewelry />);

    expect(screen.getByRole('heading', { name: 'Trending Jewelry' })).toBeTruthy();
    expect(screen.getByText('Fresh from our collection')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View all' }).getAttribute('href')).toBe('/marketplace/jewelry');
  });

  it('shows a loader while products load', () => {
    mockedUseProducts.mockReturnValue({ data: undefined, isLoading: true });
    render(<TrendingJewelry />);

    expect(screen.getByRole('status', { name: 'Loading trending jewelry' })).toBeTruthy();
  });

  it('shows an empty message when there is nothing trending', () => {
    mockedUseProducts.mockReturnValue({ data: [], isLoading: false });
    render(<TrendingJewelry />);

    expect(screen.getByText('No trending jewelry available right now.')).toBeTruthy();
  });

  it('shows no products and no empty message when the request failed', () => {
    mockedUseProducts.mockReturnValue({ data: undefined, isLoading: false });
    render(<TrendingJewelry />);

    expect(screen.queryByText('No trending jewelry available right now.')).toBeNull();
    expect(screen.queryByText('Heritage Necklace')).toBeNull();
  });

  it('shows a card for every product', () => {
    render(<TrendingJewelry />);

    expect(screen.getByText('Heritage Necklace')).toBeTruthy();
    expect(screen.getByText('Classic Ring')).toBeTruthy();
  });
});

describe('ProductCard', () => {
  const config = {
    title: 't',
    subtitle: 's',
    viewAllLabel: 'v',
    viewAllUrl: '/v',
    viewDetailsLabel: 'View details',
    newBadgeLabel: 'New',
  };

  it('shows the title, price and image', () => {
    render(<ProductCard product={products[0]} config={config} />);

    expect(screen.getByText('Heritage Necklace')).toBeTruthy();
    expect(screen.getByText('₹1,25,000')).toBeTruthy();
    expect(screen.getByAltText('A necklace')).toBeTruthy();
  });

  it('links to the product details', () => {
    render(<ProductCard product={products[0]} config={config} />);

    expect(screen.getByRole('link', { name: 'View details' }).getAttribute('href')).toBe('/marketplace/p1');
  });

  it('shows the New badge only for new products', () => {
    const { rerender } = render(<ProductCard product={products[0]} config={config} />);
    expect(screen.getByText('New')).toBeTruthy();

    rerender(<ProductCard product={products[1]} config={config} />);
    expect(screen.queryByText('New')).toBeNull();
  });
});

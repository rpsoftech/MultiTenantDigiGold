import { fireEvent, render, screen } from '@testing-library/react';
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
// A complete React Query result for the hook mock: the component reads isSuccess/isError
// (an empty list is only "empty" after a successful load) and refetch for its Retry button.
const refetch = jest.fn();
function queryState({
  data,
  isLoading = false,
  isError = false,
}: {
  data: unknown;
  isLoading?: boolean;
  isError?: boolean;
}) {
  return {
    data,
    isLoading,
    isError,
    isSuccess: !isLoading && !isError,
    error: isError
      ? { message: 'down', code: 'ERR_BAD_RESPONSE', status: 503 }
      : null,
    isFetching: false,
    refetch,
  };
}

const products: Product[] = [
  {
    id: 'p1',
    title: 'Heritage Necklace',
    imageUrl: '/n.png',
    imageAlt: 'A necklace',
    price: 125000,
    currency: 'INR',
    isNew: true,
    code: 'HN-1',
    weight: 12.5,
    carat: '22KT Gold',
    color: 'Yellow',
    category: 'necklace',
    designType: 'Classic',
    gender: 'Ladies',
    collection: 'Heritage',
    gifts: 'For Her',
  },
  {
    id: 'p2',
    title: 'Classic Ring',
    imageUrl: '/r.png',
    imageAlt: 'A ring',
    price: 42000,
    currency: 'INR',
    isNew: false,
    code: 'CR-2',
    weight: 4.2,
    carat: '22KT Gold',
    color: 'Yellow',
    category: 'ring',
    designType: 'Classic',
    gender: 'Ladies',
    collection: 'Heritage',
    gifts: 'For Her',
  },
];

describe('TrendingJewelry', () => {
  beforeEach(() =>
    mockedUseProducts.mockReturnValue(
      queryState({ data: products, isLoading: false }),
    ),
  );

  it('shows the heading, subtitle and a link to everything', () => {
    render(<TrendingJewelry />);

    expect(
      screen.getByRole('heading', { name: 'Trending Jewelry' }),
    ).toBeTruthy();
    expect(screen.getByText('Fresh from our collection')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'View all' }).getAttribute('href'),
    ).toBe('/marketplace/jewelry');
  });

  it('shows a loader while products load', () => {
    mockedUseProducts.mockReturnValue(
      queryState({ data: undefined, isLoading: true }),
    );
    render(<TrendingJewelry />);

    expect(
      screen.getByRole('status', { name: 'Loading trending jewelry' }),
    ).toBeTruthy();
  });

  it('shows an empty message when there is nothing trending', () => {
    mockedUseProducts.mockReturnValue(
      queryState({ data: [], isLoading: false }),
    );
    render(<TrendingJewelry />);

    expect(
      screen.getByText('No trending jewelry available right now.'),
    ).toBeTruthy();
  });

  it('explains a failed request and retries it, without claiming nothing is trending', () => {
    mockedUseProducts.mockReturnValue(
      queryState({ data: undefined, isError: true }),
    );
    render(<TrendingJewelry />);

    expect(screen.getByRole('alert').textContent).toContain(
      "We couldn't load trending jewelry.",
    );
    expect(
      screen.queryByText('No trending jewelry available right now.'),
    ).toBeNull();
    expect(screen.queryByText('Heritage Necklace')).toBeNull();
    fireEvent.click(
      screen.getByRole('button', { name: 'Retry loading trending jewelry' }),
    );
    expect(refetch).toHaveBeenCalledTimes(1);
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

    expect(
      screen.getByRole('link', { name: 'View details' }).getAttribute('href'),
    ).toBe('/jewellery/product?id=p1');
  });

  it('shows the New badge only for new products', () => {
    const { rerender } = render(
      <ProductCard product={products[0]} config={config} />,
    );
    expect(screen.getByText('New')).toBeTruthy();

    rerender(<ProductCard product={products[1]} config={config} />);
    expect(screen.queryByText('New')).toBeNull();
  });
});

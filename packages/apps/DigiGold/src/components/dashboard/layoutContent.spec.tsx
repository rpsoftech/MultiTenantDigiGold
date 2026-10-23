import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/renderWithProviders';
import { useCategories } from '@/features/marketplace/hooks/useCategories';
import { useTrendingProducts } from '@/features/marketplace/hooks/useTrendingProducts';
import { DEFAULT_TENANT_CONFIG } from '@/features/tenant/tenant.defaults';
import { PromoCarousel } from './PromoCarousel/PromoCarousel';
import { CategoryCarousel } from './CategoryCarousel/CategoryCarousel';
import { DashboardEssentials } from './DashboardEssentials/DashboardEssentials';
import { TrendingJewelry } from './TrendingJewelry/TrendingJewelry';

// Content a tenant publishes in its layout block replaces the built-in content, and the
// marketplace fetch is skipped for it.

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));
jest.mock('@/features/marketplace/hooks/useCategories', () => ({ useCategories: jest.fn() }));
jest.mock('@/features/marketplace/hooks/useTrendingProducts', () => ({
  useTrendingProducts: jest.fn(),
}));

const idleQuery = {
  data: undefined,
  isLoading: false,
  isError: false,
  isSuccess: false,
  error: null,
  isFetching: false,
  refetch: jest.fn(),
};
const mockedCategories = useCategories as jest.Mock;
const mockedTrending = useTrendingProducts as jest.Mock;

beforeEach(() => {
  mockedCategories.mockReturnValue(idleQuery);
  mockedTrending.mockReturnValue(idleQuery);
});

describe('PromoCarousel with published slides', () => {
  it('shows the tenant slides instead of the built-in ones', () => {
    renderWithProviders(
      <PromoCarousel
        slides={[
          { id: 'a', imageUrl: '/tenant/a.png', imageAlt: 'Tenant offer', linkUrl: '/jewellery' },
        ]}
      />
    );

    expect(screen.getByAltText('Tenant offer')).toBeTruthy();
    expect(screen.queryByAltText('Festive gold savings offer')).toBeNull();
  });

  it('keeps the built-in slides when none are published', () => {
    renderWithProviders(<PromoCarousel />);

    expect(screen.getByAltText('Festive gold savings offer')).toBeTruthy();
  });
});

describe('CategoryCarousel with published categories', () => {
  const categories = [
    { id: 'c1', label: 'Rings', imageUrl: '/c1.png', imageAlt: 'Rings', url: '/jewellery/rings' },
  ];

  it('shows the tenant title and categories without fetching the marketplace', () => {
    renderWithProviders(<CategoryCarousel title="Our collections" categories={categories} />);

    expect(screen.getByRole('heading', { name: 'Our collections' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Rings/ }).getAttribute('href')).toBe(
      '/jewellery/rings'
    );
    expect(mockedCategories).toHaveBeenCalledWith({ enabled: false });
  });

  it('still fetches the marketplace categories when none are published', () => {
    renderWithProviders(<CategoryCarousel />);

    expect(mockedCategories).toHaveBeenCalledWith({ enabled: true });
  });
});

describe('DashboardEssentials with published items', () => {
  const items = [
    { id: 'i1', title: 'Our vault', description: 'See it', url: '/vault', icon: 'wallet' as const, module: 'vault' as const },
    { id: 'i2', title: 'Shop', description: 'Browse', url: '/jewellery', icon: 'gem' as const },
  ];

  it('shows the tenant cards', () => {
    renderWithProviders(<DashboardEssentials title="Quick links" items={items} />, {
      preloaded: { tenant: { config: DEFAULT_TENANT_CONFIG } },
    });

    expect(screen.getByRole('heading', { name: 'Quick links' })).toBeTruthy();
    expect(screen.getByText('Our vault')).toBeTruthy();
    expect(screen.getByText('Shop')).toBeTruthy();
  });

  it('hides a published card whose module the tenant switched off', () => {
    renderWithProviders(<DashboardEssentials items={items} />, {
      preloaded: {
        tenant: {
          config: {
            ...DEFAULT_TENANT_CONFIG,
            activeModules: { ...DEFAULT_TENANT_CONFIG.activeModules, vault: false },
          },
        },
      },
    });

    expect(screen.queryByText('Our vault')).toBeNull();
    expect(screen.getByText('Shop')).toBeTruthy();
  });
});

describe('TrendingJewelry with published products', () => {
  const products = [
    {
      id: 'p1',
      title: 'Gold ring',
      imageUrl: '/p1.png',
      imageAlt: 'Gold ring',
      price: 12500,
      currency: 'INR',
      isNew: true,
      href: '/jewellery/product?id=p1',
    },
  ];

  it('shows the tenant products and copy without fetching the marketplace', () => {
    renderWithProviders(
      <TrendingJewelry products={products} title="Bestsellers" viewAllUrl="/jewellery" />
    );

    expect(screen.getByRole('heading', { name: 'Bestsellers' })).toBeTruthy();
    expect(screen.getByText('Gold ring')).toBeTruthy();
    expect(screen.getByText(/12,500/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View Details' }).getAttribute('href')).toBe(
      '/jewellery/product?id=p1'
    );
    expect(mockedTrending).toHaveBeenCalledWith({ enabled: false });
  });

  it('keeps the built-in copy for fields the tenant did not publish', () => {
    renderWithProviders(<TrendingJewelry products={products} />);

    expect(screen.getByRole('heading', { name: 'Trending Jewelry' })).toBeTruthy();
  });
});

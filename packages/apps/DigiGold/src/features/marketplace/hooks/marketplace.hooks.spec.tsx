import { waitFor } from '@testing-library/react';
import { renderHookWithProviders } from '@/test-utils/renderWithProviders';
import { marketplaceService } from '../marketplace.service';
import { useCategories } from './useCategories';
import { useTrendingProducts } from './useTrendingProducts';

jest.mock('../marketplace.service', () => ({
  marketplaceService: {
    getCategories: jest.fn(),
    getTrendingProducts: jest.fn(),
  },
}));

const mockedService = marketplaceService as jest.Mocked<
  typeof marketplaceService
>;

describe('useCategories', () => {
  beforeEach(() => jest.clearAllMocks());

  it('loads the categories', async () => {
    const categories = [
      {
        id: 'c1',
        label: 'Rings',
        imageUrl: '/r',
        imageAlt: 'Rings',
        url: '/r',
      },
    ];
    mockedService.getCategories.mockResolvedValue(categories);
    const { result } = renderHookWithProviders(() => useCategories());

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.data).toEqual(categories));
  });

  it('reports a failure', async () => {
    mockedService.getCategories.mockRejectedValue({
      status: 500,
      message: 'down',
    });
    const { result } = renderHookWithProviders(() => useCategories());

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useTrendingProducts', () => {
  beforeEach(() => jest.clearAllMocks());

  it('loads the trending products', async () => {
    const products = [
      {
        id: 'p1',
        title: 'Necklace',
        imageUrl: '/n',
        imageAlt: 'Necklace',
        price: 50000,
        currency: 'INR',
        isNew: false,
        url: '/p1',
      },
    ];
    mockedService.getTrendingProducts.mockResolvedValue(products);
    const { result } = renderHookWithProviders(() => useTrendingProducts());

    await waitFor(() => expect(result.current.data).toEqual(products));
  });

  it('reports a failure', async () => {
    mockedService.getTrendingProducts.mockRejectedValue({
      status: 500,
      message: 'down',
    });
    const { result } = renderHookWithProviders(() => useTrendingProducts());

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

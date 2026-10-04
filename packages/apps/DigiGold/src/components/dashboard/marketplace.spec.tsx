import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { marketplaceService } from '@/features/marketplace/marketplace.service';
import { CategoryCarousel } from './CategoryCarousel/CategoryCarousel';
import { TrendingJewelry } from './TrendingJewelry/TrendingJewelry';

let queryClient: QueryClient;

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity } },
  });
});

afterEach(() => {
  cleanup();
  queryClient.clear();
  jest.restoreAllMocks();
});

describe.each([
  {
    name: 'categories',
    Component: CategoryCarousel,
    retryLabel: 'Retry loading categories',
    emptyText: 'No categories available right now.',
    itemText: 'Gold rings',
    mockRequest: (empty = false) =>
      jest.spyOn(marketplaceService, 'getCategories').mockResolvedValue(
        empty
          ? []
          : [
              {
                id: 'rings',
                label: 'Gold rings',
                imageUrl: '/rings.jpg',
                imageAlt: 'Rings',
                url: '/marketplace/rings',
              },
            ],
      ),
  },
  {
    name: 'trending jewelry',
    Component: TrendingJewelry,
    retryLabel: 'Retry loading trending jewelry',
    emptyText: 'No trending jewelry available right now.',
    itemText: 'Classic gold ring',
    mockRequest: (empty = false) =>
      jest.spyOn(marketplaceService, 'getTrendingProducts').mockResolvedValue(
        empty
          ? []
          : [
              {
                id: 'ring-1',
                title: 'Classic gold ring',
                imageUrl: '/ring.jpg',
                imageAlt: 'Gold ring',
                price: 5000,
                currency: 'INR',
                isNew: false,
                url: '/marketplace/ring-1',
              },
            ],
      ),
  },
])('$name', ({ Component, mockRequest, retryLabel, emptyText, itemText }) => {
  it('shows the API failure and recovers when the user retries', async () => {
    const request = mockRequest().mockRejectedValueOnce({
      message: 'Network Error',
      code: 'ERR_NETWORK',
      status: null,
    });
    render(
      <QueryClientProvider client={queryClient}>
        <Component />
      </QueryClientProvider>,
    );

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(
      "Can't reach the server. Check your connection and try again.",
    );
    expect(screen.queryByText(emptyText)).toBeNull();
    expect(request).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: retryLabel }));
    expect(await screen.findByText(itemText)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(emptyText)).toBeNull();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('shows the empty state for a successful response with no items', async () => {
    mockRequest(true);
    render(
      <QueryClientProvider client={queryClient}>
        <Component />
      </QueryClientProvider>,
    );

    expect(await screen.findByText(emptyText)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('button', { name: retryLabel })).toBeNull();
  });
});

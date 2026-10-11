import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { marketplaceService } from '@/features/marketplace/marketplace.service';
import { CategoryCatalogue } from './CategoryCatalogue';
import { product, renderable } from '../testUtils';

jest.mock('@/features/marketplace/marketplace.service', () => ({
  marketplaceService: { getCategoryProducts: jest.fn(), getProduct: jest.fn() },
}));

// Filters and sort live in the URL: the page starts from the query string and replaces it
// on every change.
let mockSearchParams = new URLSearchParams();
// Like the real router: the new query string is what useSearchParams returns next.
const mockReplace = jest.fn((url: string) => {
  mockSearchParams = new URLSearchParams(url.split('?')[1] ?? '');
});
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
  usePathname: () => '/jewellery/category/bangles',
  useSearchParams: () => mockSearchParams,
}));

const getCategoryProducts = jest.mocked(marketplaceService.getCategoryProducts);

const PRODUCTS = [
  product({
    id: 'b-1',
    title: 'Mid Bangle',
    price: 300000,
    carat: '22KT Gold',
    color: 'Yellow',
  }),
  product({
    id: 'b-2',
    title: 'Cheap Bangle',
    price: 85000,
    carat: '18KT Gold',
    color: 'Rose',
    isNew: true,
  }),
  product({
    id: 'b-3',
    title: 'Premium Bangle',
    price: 900000,
    carat: '22KT Gold',
    color: 'Yellow',
  }),
];

function titlesInOrder() {
  return screen
    .getAllByRole('article')
    .map(
      (card) =>
        within(card).getByRole('link', { name: /^\w+ Bangle$/ }).textContent,
    );
}

function lastUrl() {
  return mockReplace.mock.calls[mockReplace.mock.calls.length - 1]?.[0];
}

async function renderLoaded() {
  getCategoryProducts.mockResolvedValue(PRODUCTS);
  render(renderable(<CategoryCatalogue categoryId="bangles" />));
  await screen.findByText('Mid Bangle');
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSearchParams = new URLSearchParams();
});
afterEach(cleanup);

describe('CategoryCatalogue', () => {
  it('lists the category and links each design to the client-side product page', async () => {
    await renderLoaded();

    expect(getCategoryProducts).toHaveBeenCalledWith('bangles');
    expect(screen.getByRole('heading', { name: 'Bangles' })).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Mid Bangle' }).getAttribute('href'),
    ).toBe('/jewellery/product?id=b-1');
  });

  it('names the purities the designs actually come in', async () => {
    await renderLoaded();

    expect(
      screen.getByText('Explore our bangles designs in 18KT and 22KT gold.'),
    ).toBeTruthy();
  });

  it('offers categories as navigation, marking the current one', async () => {
    await renderLoaded();

    const nav = screen.getByRole('navigation', {
      name: 'Jewellery categories',
    });
    expect(
      within(nav)
        .getByRole('link', { name: 'Bangles' })
        .getAttribute('aria-current'),
    ).toBe('page');
    expect(
      within(nav).getByRole('link', { name: 'Rings' }).getAttribute('href'),
    ).toBe('/jewellery/category/rings');
  });

  it('keeps the catalogue order by default and sorts with the native select', async () => {
    await renderLoaded();
    expect(titlesInOrder()).toEqual(['Mid Bangle', 'Cheap Bangle', 'Premium Bangle']);

    fireEvent.change(screen.getByLabelText('Sort by'), {
      target: { value: 'price-low' },
    });
    expect(titlesInOrder()).toEqual([
      'Cheap Bangle',
      'Mid Bangle',
      'Premium Bangle',
    ]);
    await waitFor(() =>
      expect(lastUrl()).toBe('/jewellery/category/bangles?sort=price-low'),
    );
  });

  it('filters by a value the designs carry and records it in the URL', async () => {
    await renderLoaded();

    fireEvent.click(screen.getByLabelText('18KT Gold'));
    expect(titlesInOrder()).toEqual(['Cheap Bangle']);
    await waitFor(() =>
      expect(lastUrl()).toBe('/jewellery/category/bangles?carat=18KT+Gold'),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(titlesInOrder()).toHaveLength(3);
    await waitFor(() => expect(lastUrl()).toBe('/jewellery/category/bangles'));
  });

  it('restores filters and sort from the URL', async () => {
    mockSearchParams = new URLSearchParams('carat=22KT+Gold&sort=price-high');
    await renderLoaded();

    expect(titlesInOrder()).toEqual(['Premium Bangle', 'Mid Bangle']);
    expect((screen.getByLabelText('18KT Gold') as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText('22KT Gold') as HTMLInputElement).checked).toBe(true);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('only offers filters that can narrow the list', async () => {
    await renderLoaded();

    // Every design is "Ladies" / "For Her": a one-option group is no filter at all.
    expect(screen.queryByRole('button', { name: 'Gender' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Gifts' })).toBeNull();
    // Price buckets with no design are left out.
    expect(screen.getByLabelText('Up to 1,00,000')).toBeTruthy();
    expect(screen.queryByLabelText('10,00,000 Above')).toBeNull();
    // Options come from the data: nothing here is "Evil Eyes Collection".
    expect(screen.queryByText('Evil Eyes Collection')).toBeNull();
  });

  it('can filter designs below 1,00,000', async () => {
    await renderLoaded();

    fireEvent.click(screen.getByLabelText('Up to 1,00,000'));
    expect(titlesInOrder()).toEqual(['Cheap Bangle']);
  });

  it('puts categories and filters behind a toggle for phones', async () => {
    await renderLoaded();
    const toggle = screen.getByRole('button', { name: /Categories & filters/ });
    const panel = document.getElementById('jewellery-filters');

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(panel?.getAttribute('data-open')).toBe('false');

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(panel?.getAttribute('data-open')).toBe('true');

    fireEvent.click(screen.getByLabelText('18KT Gold'));
    expect(toggle.textContent).toContain('(1)');
  });

  it('shows a load failure as an error with retry, not as "no matches"', async () => {
    getCategoryProducts.mockRejectedValueOnce({
      message: 'Server unavailable',
      code: 'ERR',
      status: 503,
    });
    render(renderable(<CategoryCatalogue categoryId="bangles" />));

    expect(
      await screen.findByText("We couldn't load these designs."),
    ).toBeTruthy();
    expect(screen.queryByText('No designs match these filters.')).toBeNull();

    getCategoryProducts.mockResolvedValue(PRODUCTS);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Mid Bangle')).toBeTruthy();
  });

  it('says a category is empty rather than suggesting filters', async () => {
    getCategoryProducts.mockResolvedValue([]);
    render(renderable(<CategoryCatalogue categoryId="anklets" />));

    expect(
      await screen.findByText('No designs in this category yet.'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
  });

  it('respects a tenant without the ecommerce module', async () => {
    render(
      renderable(<CategoryCatalogue categoryId="bangles" />, {
        ecommerce: false,
      }),
    );

    expect(screen.getByText("Jewellery isn't available here")).toBeTruthy();
    await waitFor(() => expect(getCategoryProducts).not.toHaveBeenCalled());
  });
});

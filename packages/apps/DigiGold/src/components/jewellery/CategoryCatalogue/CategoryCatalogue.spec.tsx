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

const getCategoryProducts = jest.mocked(marketplaceService.getCategoryProducts);

const PRODUCTS = [
  product({
    id: 'b-1',
    title: 'Mid Bangle',
    price: 300000,
    carat: '22KT Gold',
  }),
  product({
    id: 'b-2',
    title: 'Cheap Bangle',
    price: 85000,
    carat: '18KT Gold',
  }),
  product({
    id: 'b-3',
    title: 'Premium Bangle',
    price: 900000,
    carat: '22KT Gold',
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

beforeEach(() => {
  jest.clearAllMocks();
});
afterEach(cleanup);

describe('CategoryCatalogue', () => {
  it('lists the category and links each design to the client-side product page', async () => {
    getCategoryProducts.mockResolvedValue(PRODUCTS);
    render(renderable(<CategoryCatalogue categoryId="bangles" />));

    expect(await screen.findByText('Mid Bangle')).toBeTruthy();
    expect(getCategoryProducts).toHaveBeenCalledWith('bangles');
    expect(screen.getByRole('heading', { name: 'Bangles' })).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Mid Bangle' }).getAttribute('href'),
    ).toBe('/jewellery/product?id=b-1');
  });

  it('offers categories as navigation, marking the current one', async () => {
    getCategoryProducts.mockResolvedValue(PRODUCTS);
    render(renderable(<CategoryCatalogue categoryId="bangles" />));
    await screen.findByText('Mid Bangle');

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

  it('sorts by price and filters by carat', async () => {
    getCategoryProducts.mockResolvedValue(PRODUCTS);
    render(renderable(<CategoryCatalogue categoryId="bangles" />));
    await screen.findByText('Mid Bangle');

    fireEvent.click(screen.getByRole('button', { name: 'Featured' }));
    fireEvent.click(screen.getByRole('option', { name: 'Price: Low to high' }));
    expect(titlesInOrder()).toEqual([
      'Cheap Bangle',
      'Mid Bangle',
      'Premium Bangle',
    ]);

    fireEvent.click(screen.getByLabelText('18KT Gold'));
    expect(titlesInOrder()).toEqual(['Cheap Bangle']);

    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(titlesInOrder()).toHaveLength(3);
  });

  it('keeps the catalogue order by default', async () => {
    getCategoryProducts.mockResolvedValue([...PRODUCTS].reverse());
    render(renderable(<CategoryCatalogue categoryId="bangles" />));
    await screen.findByText('Mid Bangle');

    expect(titlesInOrder()).toEqual([
      'Premium Bangle',
      'Cheap Bangle',
      'Mid Bangle',
    ]);
  });

  it('moves through sort options with the arrow keys and returns focus', async () => {
    getCategoryProducts.mockResolvedValue(PRODUCTS);
    render(renderable(<CategoryCatalogue categoryId="bangles" />));
    await screen.findByText('Mid Bangle');

    const trigger = screen.getByRole('button', { name: 'Featured' });
    fireEvent.click(trigger);
    expect(document.activeElement).toBe(
      screen.getByRole('option', { name: /^Featured/ }),
    );

    const listbox = screen.getByRole('listbox', { name: 'Sort products' });
    fireEvent.keyDown(listbox, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(
      screen.getByRole('option', { name: 'Newest' }),
    );
    fireEvent.keyDown(listbox, { key: 'End' });
    fireEvent.click(document.activeElement as HTMLElement);
    expect(titlesInOrder()[0]).toBe('Premium Bangle');
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Price: High to low' }),
    );
  });

  it('can filter light designs under 10 gm', async () => {
    getCategoryProducts.mockResolvedValue([
      ...PRODUCTS,
      product({ id: 'b-4', title: 'Light Bangle', weight: 6 }),
    ]);
    render(renderable(<CategoryCatalogue categoryId="bangles" />));
    await screen.findByText('Light Bangle');

    fireEvent.click(screen.getByLabelText('Under 10 gm'));
    expect(titlesInOrder()).toEqual(['Light Bangle']);
  });

  it('only makes collapsible filter headings buttons', async () => {
    getCategoryProducts.mockResolvedValue(PRODUCTS);
    render(renderable(<CategoryCatalogue categoryId="bangles" />));
    await screen.findByText('Mid Bangle');

    expect(screen.queryByRole('button', { name: 'Weight' })).toBeNull();
    expect(
      screen
        .getByRole('button', { name: 'Design Types' })
        .getAttribute('aria-expanded'),
    ).toBe('false');
  });

  it('waits for the tenant config before loading or showing designs', async () => {
    render(
      renderable(<CategoryCatalogue categoryId="bangles" />, {
        ecommerce: false,
        resolved: false,
      }),
    );

    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.queryByText("Jewellery isn't available here")).toBeNull();
    await waitFor(() => expect(getCategoryProducts).not.toHaveBeenCalled());
  });

  it('labels the sample catalogue', async () => {
    const original = process.env.NEXT_PUBLIC_USE_MOCK_MARKETPLACE_CATEGORY;
    process.env.NEXT_PUBLIC_USE_MOCK_MARKETPLACE_CATEGORY = 'true';
    try {
      getCategoryProducts.mockResolvedValue(PRODUCTS);
      render(renderable(<CategoryCatalogue categoryId="bangles" />));
      await screen.findByText('Mid Bangle');
      expect(screen.getByRole('note').textContent).toContain(
        'Sample catalogue.',
      );
    } finally {
      if (original === undefined) {
        delete process.env.NEXT_PUBLIC_USE_MOCK_MARKETPLACE_CATEGORY;
      } else {
        process.env.NEXT_PUBLIC_USE_MOCK_MARKETPLACE_CATEGORY = original;
      }
    }
  });

  it('can filter designs below 1,00,000', async () => {
    getCategoryProducts.mockResolvedValue(PRODUCTS);
    render(renderable(<CategoryCatalogue categoryId="bangles" />));
    await screen.findByText('Mid Bangle');

    fireEvent.click(screen.getByLabelText('Up to 1,00,000'));
    expect(titlesInOrder()).toEqual(['Cheap Bangle']);
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

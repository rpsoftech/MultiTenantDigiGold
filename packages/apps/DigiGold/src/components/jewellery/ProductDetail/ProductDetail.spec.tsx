import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useSearchParams } from 'next/navigation';
import { marketplaceService } from '@/features/marketplace/marketplace.service';
import { ProductDetail } from './ProductDetail';
import { product, renderable } from '../testUtils';

jest.mock('next/navigation', () => ({ useSearchParams: jest.fn() }));
jest.mock('@/features/marketplace/marketplace.service', () => ({
  marketplaceService: { getCategoryProducts: jest.fn(), getProduct: jest.fn() },
}));

const getProduct = jest.mocked(marketplaceService.getProduct);

function visit(id: string | null) {
  jest
    .mocked(useSearchParams)
    .mockReturnValue(
      new URLSearchParams(
        id === null ? '' : `id=${id}`,
      ) as unknown as ReturnType<typeof useSearchParams>,
    );
}

beforeEach(() => {
  jest.clearAllMocks();
});
afterEach(cleanup);

describe('ProductDetail', () => {
  it('loads the product named in ?id= and shows its real price with paise', async () => {
    visit('bangles-design-1');
    getProduct.mockResolvedValue(product());
    render(renderable(<ProductDetail />));

    expect(
      await screen.findByRole('heading', { name: 'Green Glow Bangle' }),
    ).toBeTruthy();
    expect(getProduct).toHaveBeenCalledWith('bangles-design-1');
    expect(screen.getByText('₹3,57,865.40')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Bangles' }).getAttribute('href'),
    ).toBe('/jewellery/category/bangles');
  });

  it('links the breadcrumb by categoryId, whatever the label says', async () => {
    visit('pendant-1');
    getProduct.mockResolvedValue(
      product({
        id: 'pendant-1',
        title: 'Lotus Pendant',
        category: 'Chain & Pendant',
        categoryId: 'chain-pendant',
      }),
    );
    render(renderable(<ProductDetail />));

    expect(
      (
        await screen.findByRole('link', { name: 'Chain & Pendant' })
      ).getAttribute('href'),
    ).toBe('/jewellery/category/chain-pendant');
  });

  it('leaves out the category link for a category without a page', async () => {
    visit('mystery-1');
    getProduct.mockResolvedValue(
      product({
        id: 'mystery-1',
        title: 'Mystery Brooch',
        category: 'Brooch',
        categoryId: 'brooch',
      }),
    );
    render(renderable(<ProductDetail />));

    await screen.findByRole('heading', { name: 'Mystery Brooch' });
    expect(screen.queryByRole('link', { name: 'Brooch' })).toBeNull();
  });

  it('offers no purchase controls that do nothing', async () => {
    visit('bangles-design-1');
    getProduct.mockResolvedValue(product());
    render(renderable(<ProductDetail />));
    await screen.findByRole('heading', { name: 'Green Glow Bangle' });

    expect(screen.queryByRole('button', { name: /Buy Now/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /bag|wishlist/i })).toBeNull();
    expect(
      screen.getByText(/Online ordering for jewellery isn't available yet/),
    ).toBeTruthy();
  });

  it('shows the BIS hallmark claim only when the product data asserts it', async () => {
    visit('bangles-design-1');
    getProduct.mockResolvedValue(product({ isBisHallmarked: false }));
    const view = render(renderable(<ProductDetail />));
    await screen.findByRole('heading', { name: 'Green Glow Bangle' });
    expect(screen.queryByText(/BIS Hallmarked/)).toBeNull();
    view.unmount();

    getProduct.mockResolvedValue(product({ isBisHallmarked: true }));
    render(renderable(<ProductDetail />));
    expect(await screen.findByText(/BIS Hallmarked/)).toBeTruthy();
  });

  it('explains an unknown product', async () => {
    visit('no-such-design');
    getProduct.mockResolvedValue(null);
    render(renderable(<ProductDetail />));

    expect(
      await screen.findByText("This design isn't available."),
    ).toBeTruthy();
    expect(
      screen
        .getByRole('link', { name: 'Browse jewellery' })
        .getAttribute('href'),
    ).toBe('/jewellery');
  });

  it('treats a missing id as unknown without calling the API', () => {
    visit(null);
    render(renderable(<ProductDetail />));

    expect(screen.getByText("This design isn't available.")).toBeTruthy();
    expect(getProduct).not.toHaveBeenCalled();
  });

  it('offers a retry when the product fails to load', async () => {
    visit('bangles-design-1');
    getProduct.mockRejectedValueOnce({
      message: 'Server unavailable',
      code: 'ERR',
      status: 503,
    });
    render(renderable(<ProductDetail />));

    expect(
      await screen.findByText("We couldn't load this design."),
    ).toBeTruthy();
    getProduct.mockResolvedValue(product());
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByRole('heading', { name: 'Green Glow Bangle' }),
    ).toBeTruthy();
  });

  it('respects a tenant without the ecommerce module', async () => {
    visit('bangles-design-1');
    render(renderable(<ProductDetail />, { ecommerce: false }));

    expect(screen.getByText("Jewellery isn't available here")).toBeTruthy();
    await waitFor(() => expect(getProduct).not.toHaveBeenCalled());
  });
});

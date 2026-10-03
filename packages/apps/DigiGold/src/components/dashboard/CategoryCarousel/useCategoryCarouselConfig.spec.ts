import { renderHook } from '@testing-library/react';
import { useCategoryCarouselConfig } from './useCategoryCarouselConfig';

jest.mock('./category-carousel.config.json', () => ({ title: 'Shop by Category' }));

describe('useCategoryCarouselConfig', () => {
  it('returns the section copy from the site config', () => {
    const { result } = renderHook(() => useCategoryCarouselConfig());

    expect(result.current.title).toBe('Shop by Category');
  });

  it('returns the same object across renders', () => {
    const { result, rerender } = renderHook(() => useCategoryCarouselConfig());
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });
});

import { renderHook } from '@testing-library/react';
import { usePromoCarouselConfig } from './usePromoCarouselConfig';

jest.mock('./promo-carousel.config.json', () => ({
  autoplayIntervalMs: 4000,
  slides: [
    { id: 'c', imageUrl: '/c', imageAlt: 'C', enabled: true, order: 3 },
    { id: 'off', imageUrl: '/o', imageAlt: 'Off', enabled: false, order: 0 },
    { id: 'a', imageUrl: '/a', imageAlt: 'A', enabled: true, order: 1 },
  ],
}));

describe('usePromoCarouselConfig', () => {
  it('keeps the configured autoplay interval', () => {
    const { result } = renderHook(() => usePromoCarouselConfig());

    expect(result.current.autoplayIntervalMs).toBe(4000);
  });

  it('drops disabled slides and sorts the rest by order', () => {
    const { result } = renderHook(() => usePromoCarouselConfig());

    expect(result.current.slides.map((slide) => slide.id)).toEqual(['a', 'c']);
  });

  it('returns the same object across renders', () => {
    const { result, rerender } = renderHook(() => usePromoCarouselConfig());
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });
});

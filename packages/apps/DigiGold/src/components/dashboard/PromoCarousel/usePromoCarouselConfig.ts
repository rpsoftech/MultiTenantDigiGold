import { useMemo } from 'react';
import rawPromoCarouselConfig from './promo-carousel.config.json';
import type { PromoCarouselConfig } from './PromoCarousel.types';

const promoCarouselConfig = rawPromoCarouselConfig as PromoCarouselConfig;

// Slide images/links/order are frontend site config, not tenant business data — editing
// promo-carousel.config.json needs no code change.
export function usePromoCarouselConfig(): PromoCarouselConfig {
  return useMemo(
    () => ({
      autoplayIntervalMs: promoCarouselConfig.autoplayIntervalMs,
      slides: promoCarouselConfig.slides
        .filter((slide) => slide.enabled)
        .sort((a, b) => a.order - b.order),
    }),
    []
  );
}

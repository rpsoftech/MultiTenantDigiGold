import { useMemo } from 'react';
import rawCategoryCarouselConfig from './category-carousel.config.json';
import type { CategoryCarouselConfig } from './CategoryCarousel.types';

const categoryCarouselConfig = rawCategoryCarouselConfig as CategoryCarouselConfig;

// Section copy (title) is frontend site config, not tenant business data — editing
// category-carousel.config.json needs no code change. Categories themselves come
// from features/marketplace (a real, mock-backed data source).
export function useCategoryCarouselConfig(): CategoryCarouselConfig {
  return useMemo(() => categoryCarouselConfig, []);
}

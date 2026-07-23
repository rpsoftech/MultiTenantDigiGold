import { useMemo } from 'react';
import rawTrendingJewelryConfig from './trending-jewelry.config.json';
import type { TrendingJewelryConfig } from './TrendingJewelry.types';

const trendingJewelryConfig = rawTrendingJewelryConfig as TrendingJewelryConfig;

// Section copy (title/subtitle/labels) is frontend site config, not tenant business
// data — editing trending-jewelry.config.json needs no code change. The products
// themselves come from features/marketplace (a real, mock-backed data source).
export function useTrendingJewelryConfig(): TrendingJewelryConfig {
  return useMemo(() => trendingJewelryConfig, []);
}

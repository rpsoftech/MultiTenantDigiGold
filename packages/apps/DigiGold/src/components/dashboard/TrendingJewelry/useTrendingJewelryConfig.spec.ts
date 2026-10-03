import { renderHook } from '@testing-library/react';
import { useTrendingJewelryConfig } from './useTrendingJewelryConfig';

jest.mock('./trending-jewelry.config.json', () => ({
  title: 'Trending',
  subtitle: 'Sub',
  viewAllLabel: 'All',
  viewAllUrl: '/all',
  viewDetailsLabel: 'Details',
  newBadgeLabel: 'New',
}));

describe('useTrendingJewelryConfig', () => {
  it('returns the section copy from the site config', () => {
    const { result } = renderHook(() => useTrendingJewelryConfig());

    expect(result.current).toMatchObject({ title: 'Trending', viewAllUrl: '/all' });
  });

  it('returns the same object across renders', () => {
    const { result, rerender } = renderHook(() => useTrendingJewelryConfig());
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });
});

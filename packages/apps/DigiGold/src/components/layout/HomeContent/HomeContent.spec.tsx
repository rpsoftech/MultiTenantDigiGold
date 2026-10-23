import { act, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/renderWithProviders';
import { DEFAULT_TENANT_CONFIG } from '@/features/tenant/tenant.defaults';
import { parseLayout } from '@/features/layout/layout.parser';
import { tenantConfigUnavailable, tenantConfigReceived } from '@/store/tenant/tenant.slice';
import type { TenantConfig } from '@/features/tenant/tenant.types';
import { HomeContent } from './HomeContent';

jest.mock('@/components/dashboard/PromoCarousel/PromoCarousel', () => ({
  PromoCarousel: () => <div>promo carousel</div>,
}));
jest.mock('@/components/dashboard/CategoryCarousel/CategoryCarousel', () => ({
  CategoryCarousel: () => <div>category carousel</div>,
}));
jest.mock('@/components/dashboard/DashboardEssentials/DashboardEssentials', () => ({
  DashboardEssentials: () => <div>dashboard essentials</div>,
}));
jest.mock('@/components/dashboard/TrendingJewelry/TrendingJewelry', () => ({
  TrendingJewelry: () => <div>trending jewelry</div>,
}));
jest.mock('@/components/dashboard/BuyGold/BuyGold', () => ({
  BuyGold: () => <div>buy gold</div>,
}));
jest.mock('../LayoutRenderer', () => ({
  hasRenderableBlock: (blocks: unknown[]) => blocks.length > 0,
  LayoutRenderer: ({ blocks }: { blocks: { type: string }[] }) => (
    <div data-testid="layout">{blocks.map((block) => block.type).join(',')}</div>
  ),
}));

const withLayout = (layout: TenantConfig['layout']): TenantConfig => ({
  ...DEFAULT_TENANT_CONFIG,
  tenantId: 'tenant-1',
  layout,
});

describe('HomeContent', () => {
  it('waits with a loading state until the tenant layout is read', () => {
    renderWithProviders(<HomeContent />, {
      preloaded: { tenant: { config: DEFAULT_TENANT_CONFIG, resolved: false } },
    });

    expect(screen.getByRole('status', { name: 'Loading your store' })).toBeTruthy();
    expect(screen.queryByText('promo carousel')).toBeNull();
  });

  it('renders the published layout', () => {
    renderWithProviders(<HomeContent />, {
      preloaded: {
        tenant: {
          config: withLayout(
            parseLayout([
              { id: 'a', type: 'Hero' },
              { id: 'b', type: 'LiveRate' },
            ])
          ),
        },
      },
    });

    expect(screen.getByTestId('layout').textContent).toBe('Hero,LiveRate');
    expect(screen.queryByText('promo carousel')).toBeNull();
  });

  it('falls back to the standard storefront when nothing is published', () => {
    renderWithProviders(<HomeContent />, {
      preloaded: { tenant: { config: withLayout([]) } },
    });

    for (const section of [
      'promo carousel',
      'category carousel',
      'dashboard essentials',
      'trending jewelry',
      'buy gold',
    ]) {
      expect(screen.getByText(section)).toBeTruthy();
    }
  });

  it('stops waiting and shows the standard storefront when the tenant API is down', () => {
    const { store } = renderWithProviders(<HomeContent />, {
      preloaded: { tenant: { config: DEFAULT_TENANT_CONFIG, resolved: false } },
    });

    act(() => {
      store.dispatch(tenantConfigUnavailable());
    });

    expect(screen.getByText('promo carousel')).toBeTruthy();
  });

  it('keeps the last good layout when a later refresh fails', () => {
    const { store } = renderWithProviders(<HomeContent />, {
      preloaded: { tenant: { config: withLayout(parseLayout([{ id: 'a', type: 'Hero' }])) } },
    });

    act(() => {
      store.dispatch(tenantConfigUnavailable());
    });

    expect(screen.getByTestId('layout').textContent).toBe('Hero');
  });

  it('switches storefront when a new layout is published and the config reloads', () => {
    const { store } = renderWithProviders(<HomeContent />, {
      preloaded: { tenant: { config: withLayout(parseLayout([{ id: 'a', type: 'Hero' }])) } },
    });
    expect(screen.getByTestId('layout').textContent).toBe('Hero');

    act(() => {
      store.dispatch(
        tenantConfigReceived(
          withLayout(
            parseLayout([
              { id: 'a', type: 'LiveRate' },
              { id: 'b', type: 'Hero' },
            ])
          )
        )
      );
    });

    expect(screen.getByTestId('layout').textContent).toBe('LiveRate,Hero');
  });
});

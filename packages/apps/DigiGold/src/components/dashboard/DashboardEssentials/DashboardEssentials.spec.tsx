import { render, renderHook, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/renderWithProviders';
import { DEFAULT_TENANT_CONFIG } from '@/features/tenant/tenant.defaults';
import type { TenantConfig } from '@/features/tenant/tenant.types';
import { DashboardEssentials } from './DashboardEssentials';
import { EssentialCard } from './EssentialCard';
import { ICON_REGISTRY } from './iconRegistry';
import { useDashboardEssentialsConfig } from './useDashboardEssentialsConfig';

jest.mock('./dashboard-essentials.config.json', () => ({
  title: 'Dashboard Essentials',
  items: [
    {
      id: 'sip',
      title: 'Start a Gold SIP',
      description: 'Automate your wealth creation.',
      url: '/invest/sip',
      icon: 'coins',
      module: 'trading',
      enabled: true,
      order: 2,
    },
    {
      id: 'passbook',
      title: 'My Digital Passbook',
      description: 'View ledger.',
      url: '/vault/passbook',
      icon: 'wallet',
      module: 'vault',
      enabled: true,
      order: 1,
    },
    {
      id: 'jewelry',
      title: 'Explore Jewelry',
      description: 'Browse collections.',
      url: '/marketplace/jewelry',
      icon: 'gem',
      module: 'ecommerce',
      enabled: true,
      order: 3,
    },
    {
      id: 'hidden',
      title: 'Hidden card',
      description: 'Disabled in config.',
      url: '/hidden',
      icon: 'gem',
      enabled: false,
      order: 0,
    },
    {
      id: 'always',
      title: 'Always visible',
      description: 'No module needed.',
      url: '/always',
      icon: 'wallet',
      enabled: true,
      order: 4,
    },
  ],
}));

const withModules = (modules: Partial<TenantConfig['activeModules']>) => ({
  preloaded: {
    tenant: {
      config: {
        ...DEFAULT_TENANT_CONFIG,
        activeModules: { ...DEFAULT_TENANT_CONFIG.activeModules, ...modules },
      },
    },
  },
});

describe('useDashboardEssentialsConfig', () => {
  it('drops disabled cards and sorts the rest by order', () => {
    const { result } = renderHook(() => useDashboardEssentialsConfig());

    expect(result.current.items.map((item) => item.id)).toEqual([
      'passbook',
      'sip',
      'jewelry',
      'always',
    ]);
    expect(result.current.title).toBe('Dashboard Essentials');
  });
});

describe('DashboardEssentials', () => {
  it('shows every card when all modules are on', () => {
    renderWithProviders(<DashboardEssentials />, withModules({}));

    expect(screen.getByRole('heading', { name: 'Dashboard Essentials' })).toBeTruthy();
    expect(screen.getByText('My Digital Passbook')).toBeTruthy();
    expect(screen.getByText('Start a Gold SIP')).toBeTruthy();
    expect(screen.getByText('Explore Jewelry')).toBeTruthy();
    expect(screen.getByText('Always visible')).toBeTruthy();
  });

  it('shows cards in the configured order', () => {
    renderWithProviders(<DashboardEssentials />, withModules({}));

    const titles = screen.getAllByRole('link').map((link) => link.textContent);
    expect(titles[0]).toContain('My Digital Passbook');
    expect(titles[titles.length - 1]).toContain('Always visible');
  });

  it('hides the cards of modules the tenant has switched off', () => {
    renderWithProviders(<DashboardEssentials />, withModules({ trading: false, ecommerce: false }));

    expect(screen.queryByText('Start a Gold SIP')).toBeNull();
    expect(screen.queryByText('Explore Jewelry')).toBeNull();
    expect(screen.getByText('My Digital Passbook')).toBeTruthy();
  });

  it('keeps cards that do not belong to any module', () => {
    renderWithProviders(
      <DashboardEssentials />,
      withModules({ trading: false, vault: false, ecommerce: false }),
    );

    expect(screen.getByText('Always visible')).toBeTruthy();
    expect(screen.queryByText('My Digital Passbook')).toBeNull();
  });

  it('shows only module free cards until the tenant is known', () => {
    renderWithProviders(<DashboardEssentials />, { preloaded: { tenant: { config: null } } });

    expect(screen.getByText('Always visible')).toBeTruthy();
    expect(screen.queryByText('My Digital Passbook')).toBeNull();
  });
});

describe('EssentialCard', () => {
  const item = {
    id: 'passbook',
    title: 'My Digital Passbook',
    description: 'View ledger.',
    url: '/vault/passbook',
    icon: 'wallet' as const,
    enabled: true,
    order: 1,
  };

  it('links to the destination with its title and description', () => {
    render(<EssentialCard item={item} />);

    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/vault/passbook');
    expect(link.textContent).toContain('My Digital Passbook');
    expect(link.textContent).toContain('View ledger.');
  });

  it('shows the icon for the item', () => {
    const { container } = render(<EssentialCard item={item} />);

    expect(container.querySelector('svg')).not.toBeNull();
  });
});

describe('dashboard icon registry', () => {
  it('maps every icon key to a component', () => {
    expect(Object.keys(ICON_REGISTRY).sort()).toEqual(['coins', 'gem', 'wallet']);
    for (const Icon of Object.values(ICON_REGISTRY)) {
      expect(typeof Icon).toBe('function');
    }
  });
});

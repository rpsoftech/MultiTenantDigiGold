import { renderWithProviders } from '@/test-utils/renderWithProviders';
import { DEFAULT_TENANT_CONFIG } from '@/features/tenant/tenant.defaults';
import { DashboardEssentials } from './DashboardEssentials';

jest.mock('./dashboard-essentials.config.json', () => ({
  title: 'Dashboard Essentials',
  items: [
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
  ],
}));

describe('DashboardEssentials with nothing to show', () => {
  it('renders nothing when the tenant has switched off every card module', () => {
    const { container } = renderWithProviders(<DashboardEssentials />, {
      preloaded: {
        tenant: {
          config: {
            ...DEFAULT_TENANT_CONFIG,
            activeModules: {
              ...DEFAULT_TENANT_CONFIG.activeModules,
              vault: false,
            },
          },
        },
      },
    });

    expect(container.querySelector('section')).toBeNull();
  });
});

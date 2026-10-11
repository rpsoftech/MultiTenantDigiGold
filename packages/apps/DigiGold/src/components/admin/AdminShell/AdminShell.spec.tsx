import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/renderWithProviders';
import { AdminShell } from './AdminShell';

jest.mock('next/navigation', () => ({
  usePathname: () => '/admin/dashboard',
}));
jest.mock('@/components/admin/AdminProfileMenu/AdminProfileMenu', () => ({
  AdminProfileMenu: () => null,
}));

describe('AdminShell', () => {
  const originalMockSetting = process.env.NEXT_PUBLIC_USE_MOCK_ADMIN;

  afterEach(() => {
    if (originalMockSetting === undefined) {
      delete process.env.NEXT_PUBLIC_USE_MOCK_ADMIN;
    } else {
      process.env.NEXT_PUBLIC_USE_MOCK_ADMIN = originalMockSetting;
    }
  });

  it('labels dashboard figures as samples when demo mode is enabled', () => {
    process.env.NEXT_PUBLIC_USE_MOCK_ADMIN = 'true';
    renderWithProviders(
      <AdminShell>
        <p>panel</p>
      </AdminShell>,
    );

    const notice = screen.getByRole('note');
    expect(notice.textContent).toContain('Sample data.');
    expect(notice.textContent).toContain("not DigiGold's records");
    expect(notice.textContent).toContain('Demo mode is enabled.');
    expect(screen.getByText('panel')).toBeTruthy();
  });

  it('shows no notice once real store data is used', () => {
    process.env.NEXT_PUBLIC_USE_MOCK_ADMIN = 'false';
    renderWithProviders(
      <AdminShell>
        <p>panel</p>
      </AdminShell>,
    );

    expect(screen.queryByRole('note')).toBeNull();
  });

  describe('audit log link', () => {
    function renderAs(adminRole: string) {
      renderWithProviders(
        <AdminShell>
          <p>panel</p>
        </AdminShell>,
        {
          user: null,
          preloaded: {
            session: {
              user: null,
              isAuthenticated: false,
              admin: {
                userId: 'admin-1',
                role: 'admin',
                adminRole,
                isNewUser: false,
                kycStatus: 'not_started',
              },
              revision: 0,
              registrationToken: null,
              registrationPhone: null,
            },
          },
        },
      );
    }

    it('is shown to super admins', () => {
      renderAs('super_admin');
      const link = screen.getByRole('link', { name: 'Audit log' });
      expect(link.getAttribute('href')).toBe('/admin/audit-events');
    });

    it.each(['manager', 'custom'])('is hidden from %s', (role) => {
      renderAs(role);
      expect(screen.queryByRole('link', { name: 'Audit log' })).toBeNull();
      expect(screen.getByRole('link', { name: 'Store ledger' })).toBeTruthy();
    });
  });
});

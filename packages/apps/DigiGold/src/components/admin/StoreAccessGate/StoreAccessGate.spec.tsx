import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/renderWithProviders';
import type { RootState } from '@/store';
import type { SessionUser } from '@/store/session/session.types';
import { StoreAccessGate } from './StoreAccessGate';

function adminSession(adminRole?: string): Partial<RootState> {
  const admin: SessionUser = {
    userId: 'admin-1',
    role: 'admin',
    isNewUser: false,
    kycStatus: 'not_started',
    ...(adminRole ? { adminRole } : {}),
  };
  return {
    session: {
      user: null,
      isAuthenticated: false,
      admin,
      revision: 0,
      registrationToken: null,
      registrationPhone: null,
    },
  };
}

describe('StoreAccessGate', () => {
  it.each(['super_admin', 'manager', undefined])(
    'shows store data to role %s',
    (adminRole) => {
      renderWithProviders(<StoreAccessGate>store panel</StoreAccessGate>, {
        user: null,
        preloaded: adminSession(adminRole),
      });
      expect(screen.getByText('store panel')).toBeTruthy();
    },
  );

  it('explains the restriction to other roles instead of loading store data', () => {
    renderWithProviders(<StoreAccessGate>store panel</StoreAccessGate>, {
      user: null,
      preloaded: adminSession('custom'),
    });
    expect(screen.queryByText('store panel')).toBeNull();
    expect(
      screen.getByText('Store data isn’t available for your role'),
    ).toBeTruthy();
  });
});

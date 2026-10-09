import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/renderWithProviders';
import type { RootState } from '@/store';
import type { SessionUser } from '@/store/session/session.types';
import { AuditAccessGate } from './AuditAccessGate';

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

describe('AuditAccessGate', () => {
  it.each(['super_admin', undefined])('shows the audit log to role %s', (role) => {
    renderWithProviders(<AuditAccessGate>audit panel</AuditAccessGate>, {
      user: null,
      preloaded: adminSession(role),
    });
    expect(screen.getByText('audit panel')).toBeTruthy();
  });

  it.each(['manager', 'custom', 'auditor'])(
    'explains the restriction to role %s',
    (role) => {
      renderWithProviders(<AuditAccessGate>audit panel</AuditAccessGate>, {
        user: null,
        preloaded: adminSession(role),
      });
      expect(screen.queryByText('audit panel')).toBeNull();
      expect(
        screen.getByText('The audit log isn’t available for your role'),
      ).toBeTruthy();
    },
  );
});

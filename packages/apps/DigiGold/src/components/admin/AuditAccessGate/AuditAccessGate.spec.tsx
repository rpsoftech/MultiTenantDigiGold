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
  it('shows the audit log to a super admin', () => {
    renderWithProviders(<AuditAccessGate>audit panel</AuditAccessGate>, {
      user: null,
      preloaded: adminSession('super_admin'),
    });
    expect(screen.getByText('audit panel')).toBeTruthy();
  });

  describe('a session without a role', () => {
    const original = process.env.NEXT_PUBLIC_USE_MOCK_ADMIN;
    afterEach(() => {
      if (original === undefined) delete process.env.NEXT_PUBLIC_USE_MOCK_ADMIN;
      else process.env.NEXT_PUBLIC_USE_MOCK_ADMIN = original;
    });

    it('is let in only in sample data mode', () => {
      process.env.NEXT_PUBLIC_USE_MOCK_ADMIN = 'true';
      renderWithProviders(<AuditAccessGate>audit panel</AuditAccessGate>, {
        user: null,
        preloaded: adminSession(undefined),
      });
      expect(screen.getByText('audit panel')).toBeTruthy();
    });

    it('is refused against the real server', () => {
      delete process.env.NEXT_PUBLIC_USE_MOCK_ADMIN;
      renderWithProviders(<AuditAccessGate>audit panel</AuditAccessGate>, {
        user: null,
        preloaded: adminSession(undefined),
      });
      expect(screen.queryByText('audit panel')).toBeNull();
    });
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

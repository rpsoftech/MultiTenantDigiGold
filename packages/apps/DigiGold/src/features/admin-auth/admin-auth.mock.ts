import type {
  AdminLoginPayload,
  AdminLoginResult,
  AdminProfile,
  UpdateAdminPasswordPayload,
  UpdateAdminProfilePayload,
} from './admin-auth.types';

// MainServer's admin auth endpoints aren't ready yet — any well-formed email/password
// pair logs in. Swapping to the real calls in admin-auth.service.ts is a one-line change
// (flip NEXT_PUBLIC_USE_MOCK_ADMIN_AUTH).

const MOCK_ADMIN_PROFILE: AdminProfile = {
  userId: 'ADMIN-001',
  name: 'Tenant Admin',
  email: 'admin@digigold.com',
  phone: '9876500000',
};

export async function mockAdminLogin(payload: AdminLoginPayload): Promise<AdminLoginResult> {
  if (!payload.password) {
    throw new Error('Incorrect email or password.');
  }
  return {
    user: {
      userId: MOCK_ADMIN_PROFILE.userId,
      role: 'admin',
      email: payload.email,
      name: MOCK_ADMIN_PROFILE.name,
      isNewUser: false,
      kycStatus: 'verified',
    },
  };
}

export async function mockGetAdminProfile(): Promise<AdminProfile> {
  return MOCK_ADMIN_PROFILE;
}

export async function mockUpdateAdminProfile(
  payload: UpdateAdminProfilePayload
): Promise<AdminProfile> {
  Object.assign(MOCK_ADMIN_PROFILE, payload);
  return MOCK_ADMIN_PROFILE;
}

export async function mockUpdateAdminPassword(
  _payload: UpdateAdminPasswordPayload
): Promise<void> {
  return;
}

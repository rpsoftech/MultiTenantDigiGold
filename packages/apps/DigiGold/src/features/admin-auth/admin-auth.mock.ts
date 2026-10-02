import type {
  AdminLoginPayload,
  AdminLoginResult,
  AdminProfile,
  AdminTokenPair,
  AdminTotpSetupPayload,
  AdminTotpSetupResult,
  AdminTotpVerifyPayload,
  UpdateAdminPasswordPayload,
  UpdateAdminProfilePayload,
} from './admin-auth.types';

// Opt-in local demo follows the same two-step flow. Use code 123456 in mock mode.
const mockChallenges = new Map<
  string,
  { username: string; expiresAt: number; setup: boolean }
>();
const enrolledUsernames = new Set<string>();
const mockRefreshTokens = new Set<string>();

function getChallenge(tempToken: string) {
  const challenge = mockChallenges.get(tempToken);
  if (!challenge || challenge.expiresAt <= Date.now()) {
    mockChallenges.delete(tempToken);
    throw new Error('invalid or expired temporary token');
  }
  return challenge;
}

function issueMockTokens(): AdminTokenPair {
  const encode = (value: object) =>
    btoa(JSON.stringify(value))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  const accessToken = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
    admin_uuid: MOCK_ADMIN_PROFILE.userId,
    role: 'manager',
    tenant_id: 1,
    aud: ['digigold:admin:access'],
    exp: Math.floor(Date.now() / 1000) + 15 * 60,
  })}.mock`;
  const refreshToken = `mock-admin-refresh-${crypto.randomUUID()}`;
  mockRefreshTokens.add(refreshToken);
  return { access_token: accessToken, refresh_token: refreshToken };
}

const MOCK_ADMIN_PROFILE: AdminProfile = {
  userId: 'ADMIN-001',
  name: 'Tenant Admin',
  email: 'admin@digigold.com',
  phone: '9876500000',
};

export async function mockAdminLogin(
  payload: AdminLoginPayload,
): Promise<AdminLoginResult> {
  if (!payload.username || !payload.password) {
    throw new Error('Incorrect username or password.');
  }
  const tempToken = `mock-admin-login-${crypto.randomUUID()}`;
  mockChallenges.set(tempToken, {
    username: payload.username,
    expiresAt: Date.now() + 5 * 60 * 1000,
    setup: false,
  });
  return { temp_token: tempToken };
}

export async function mockAdminTotpSetup(
  payload: AdminTotpSetupPayload,
): Promise<AdminTotpSetupResult | null> {
  const challenge = getChallenge(payload.temp_token);
  if (enrolledUsernames.has(challenge.username)) return null;
  challenge.setup = true;
  return {
    otpauth_uri: `otpauth://totp/DigiGold-Admin:${encodeURIComponent(challenge.username)}?secret=JBSWY3DPEHPK3PXP&issuer=DigiGold-Admin`,
  };
}

export async function mockAdminTotpVerify(
  payload: AdminTotpVerifyPayload,
): Promise<AdminTokenPair> {
  const challenge = getChallenge(payload.temp_token);
  if (!challenge.setup && !enrolledUsernames.has(challenge.username)) {
    throw new Error('TOTP secret not found, please call setup first');
  }
  if (payload.code !== '123456') throw new Error('invalid TOTP code');
  enrolledUsernames.add(challenge.username);
  mockChallenges.delete(payload.temp_token);
  return issueMockTokens();
}

export async function mockAdminRefresh(
  refreshToken: string | null,
): Promise<AdminTokenPair> {
  if (!refreshToken || !mockRefreshTokens.delete(refreshToken)) {
    throw {
      message: 'Your demo session expired. Please sign in again.',
      status: 401,
      code: 'ADMIN_SESSION_EXPIRED',
    };
  }
  return issueMockTokens();
}

export async function mockGetAdminProfile(): Promise<AdminProfile> {
  return MOCK_ADMIN_PROFILE;
}

export async function mockUpdateAdminProfile(
  payload: UpdateAdminProfilePayload,
): Promise<AdminProfile> {
  Object.assign(MOCK_ADMIN_PROFILE, payload);
  return MOCK_ADMIN_PROFILE;
}

export async function mockUpdateAdminPassword(
  _payload: UpdateAdminPasswordPayload,
): Promise<void> {
  return;
}

import type { NormalizedApiError } from '@/lib/api/client';
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
// Live mock refresh tokens and the admin each belongs to (single use, like MainServer).
const mockRefreshTokens = new Map<string, string>();

// Mock failures mirror MainServer's (admin_auth_service.go): the same status and stable
// error name, already in apiClient's normalized shape, so the UI is exercised exactly as
// it is against the real API.
function mockError(
  status: number,
  code: string,
  message: string,
): NormalizedApiError {
  return { status, code, message };
}

function getChallenge(tempToken: string) {
  const challenge = mockChallenges.get(tempToken);
  if (!challenge || challenge.expiresAt <= Date.now()) {
    mockChallenges.delete(tempToken);
    throw mockError(
      401,
      'ADMIN_TEMP_TOKEN_INVALID',
      'Your sign-in has expired. Please enter your password again.',
    );
  }
  return challenge;
}

function issueMockTokens(username: string): AdminTokenPair {
  const encode = (value: object) =>
    btoa(JSON.stringify(value))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  const accessToken = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
    admin_uuid: MOCK_ADMIN_PROFILE.userId,
    role: 'manager',
    tenant_id: 1,
    username,
    aud: ['digigold:admin:access'],
    exp: Math.floor(Date.now() / 1000) + 15 * 60,
  })}.mock`;
  const refreshToken = `mock-admin-refresh-${crypto.randomUUID()}`;
  mockRefreshTokens.set(refreshToken, username);
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
    throw mockError(401, 'InvalidCredentials', 'Invalid credentials');
  }
  const tempToken = `mock-admin-login-${crypto.randomUUID()}`;
  mockChallenges.set(tempToken, {
    username: payload.username,
    expiresAt: Date.now() + 5 * 60 * 1000,
    setup: false,
  });
  return {
    temp_token: tempToken,
    totp_enabled: enrolledUsernames.has(payload.username),
  };
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
    throw mockError(
      400,
      'ADMIN_TOTP_NOT_SET_UP',
      'Set up your authenticator app before entering a code.',
    );
  }
  if (payload.code !== '123456') {
    throw mockError(
      401,
      'ADMIN_TOTP_CODE_INVALID',
      'That code is incorrect or has expired.',
    );
  }
  enrolledUsernames.add(challenge.username);
  mockChallenges.delete(payload.temp_token);
  return issueMockTokens(challenge.username);
}

export async function mockAdminRefresh(
  refreshToken: string | null,
): Promise<AdminTokenPair> {
  const username = refreshToken
    ? mockRefreshTokens.get(refreshToken)
    : undefined;
  if (!refreshToken || username === undefined) {
    throw {
      message: 'Your demo session expired. Please sign in again.',
      status: 401,
      code: 'ADMIN_SESSION_EXPIRED',
    };
  }
  mockRefreshTokens.delete(refreshToken);
  return issueMockTokens(username);
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

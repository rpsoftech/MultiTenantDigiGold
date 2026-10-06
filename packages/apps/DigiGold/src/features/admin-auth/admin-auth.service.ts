import {
  apiClient,
  isNormalizedApiError,
  refreshAdminTokens,
} from '@/lib/api/client';
import {
  getAdminRefreshToken,
  getAdminSessionId,
  getAdminTokenRevision,
  rotateAdminTokens,
  storeAdminTokens,
} from '@/lib/api/admin-tokens';
import type { ApiResponse } from '@/types/api.types';
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
import {
  mockAdminLogin,
  mockAdminTotpSetup,
  mockAdminTotpVerify,
  mockAdminRefresh,
  mockGetAdminProfile,
  mockUpdateAdminPassword,
  mockUpdateAdminProfile,
} from './admin-auth.mock';

function shouldUseMockAdminAuth() {
  return process.env.NEXT_PUBLIC_USE_MOCK_ADMIN_AUTH === 'true';
}

export const adminAuthService = {
  login: async (payload: AdminLoginPayload): Promise<AdminLoginResult> => {
    if (shouldUseMockAdminAuth()) return mockAdminLogin(payload);
    const response = await apiClient.post<AdminLoginResult>(
      '/admin/auth/login',
      payload,
    );
    if (
      typeof response.data?.temp_token !== 'string' ||
      !response.data.temp_token
    ) {
      throw new Error('The server did not return a temporary login token.');
    }
    return response.data;
  },

  setupTotp: async (
    payload: AdminTotpSetupPayload,
  ): Promise<AdminTotpSetupResult | null> => {
    if (shouldUseMockAdminAuth()) return mockAdminTotpSetup(payload);
    try {
      const response = await apiClient.post<AdminTotpSetupResult>(
        '/admin/auth/totp/setup',
        payload,
      );
      if (
        typeof response.data?.otpauth_uri !== 'string' ||
        !response.data.otpauth_uri
      ) {
        throw new Error(
          'The server did not return an authenticator enrollment URI.',
        );
      }
      return response.data;
    } catch (error) {
      // Login supplies no enrollment flag. Only this setup response means the admin
      // should use their existing authenticator. Matched on MainServer's stable error
      // name, never the message text, which may be reworded or translated.
      if (
        isNormalizedApiError(error) &&
        error.code === 'ADMIN_TOTP_ALREADY_ENABLED'
      ) {
        return null;
      }
      throw error;
    }
  },

  verifyTotp: async (
    payload: AdminTotpVerifyPayload,
  ): Promise<AdminTokenPair> => {
    const tokens = shouldUseMockAdminAuth()
      ? await mockAdminTotpVerify(payload)
      : (
          await apiClient.post<AdminTokenPair>(
            '/admin/auth/totp/verify',
            payload,
          )
        ).data;
    if (
      typeof tokens?.access_token !== 'string' ||
      !tokens.access_token ||
      typeof tokens?.refresh_token !== 'string' ||
      !tokens.refresh_token
    ) {
      throw new Error('The server did not return valid admin tokens.');
    }
    storeAdminTokens(tokens);
    return tokens;
  },

  // Revokes the session's refresh token on MainServer. Best effort: logout must still
  // complete locally when offline, so failures are swallowed here.
  logout: async (refreshToken: string | null): Promise<void> => {
    if (shouldUseMockAdminAuth() || !refreshToken) return;
    try {
      await apiClient.post('/admin/auth/logout', {
        refresh_token: refreshToken,
      });
    } catch {
      // The token still expires on its own; nothing more the client can do.
    }
  },

  refresh: async (): Promise<AdminTokenPair> => {
    if (!shouldUseMockAdminAuth()) return refreshAdminTokens();
    const refreshToken = getAdminRefreshToken();
    const revision = getAdminTokenRevision();
    const sessionId = getAdminSessionId();
    const tokens = await mockAdminRefresh(refreshToken);
    if (
      getAdminTokenRevision() !== revision ||
      getAdminRefreshToken() !== refreshToken ||
      getAdminSessionId() !== sessionId
    ) {
      throw new Error('The admin session changed while refreshing.');
    }
    rotateAdminTokens(tokens);
    return tokens;
  },

  getProfile: async (): Promise<AdminProfile> => {
    if (shouldUseMockAdminAuth()) return mockGetAdminProfile();
    const response =
      await apiClient.get<ApiResponse<AdminProfile>>('/admin/profile');
    return response.data.data;
  },

  updateProfile: async (
    payload: UpdateAdminProfilePayload,
  ): Promise<AdminProfile> => {
    if (shouldUseMockAdminAuth()) return mockUpdateAdminProfile(payload);
    const response = await apiClient.patch<ApiResponse<AdminProfile>>(
      '/admin/profile',
      payload,
    );
    return response.data.data;
  },

  updatePassword: async (
    payload: UpdateAdminPasswordPayload,
  ): Promise<void> => {
    if (shouldUseMockAdminAuth()) return mockUpdateAdminPassword(payload);
    await apiClient.post<ApiResponse<null>>('/admin/change-password', payload);
  },
};

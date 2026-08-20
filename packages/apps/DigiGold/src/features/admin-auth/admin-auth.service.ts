import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api.types';
import type {
  AdminLoginPayload,
  AdminLoginResult,
  AdminProfile,
  UpdateAdminPasswordPayload,
  UpdateAdminProfilePayload,
} from './admin-auth.types';
import {
  mockAdminLogin,
  mockGetAdminProfile,
  mockUpdateAdminPassword,
  mockUpdateAdminProfile,
} from './admin-auth.mock';

const USE_MOCK_ADMIN_AUTH = process.env.NEXT_PUBLIC_USE_MOCK_ADMIN_AUTH === 'true';

export const adminAuthService = {
  login: async (payload: AdminLoginPayload): Promise<AdminLoginResult> => {
    if (USE_MOCK_ADMIN_AUTH) return mockAdminLogin(payload);
    const response = await apiClient.post<ApiResponse<AdminLoginResult>>(
      '/admin/auth/login',
      payload
    );
    return response.data.data;
  },

  getProfile: async (): Promise<AdminProfile> => {
    if (USE_MOCK_ADMIN_AUTH) return mockGetAdminProfile();
    const response = await apiClient.get<ApiResponse<AdminProfile>>('/admin/profile');
    return response.data.data;
  },

  updateProfile: async (payload: UpdateAdminProfilePayload): Promise<AdminProfile> => {
    if (USE_MOCK_ADMIN_AUTH) return mockUpdateAdminProfile(payload);
    const response = await apiClient.patch<ApiResponse<AdminProfile>>('/admin/profile', payload);
    return response.data.data;
  },

  updatePassword: async (payload: UpdateAdminPasswordPayload): Promise<void> => {
    if (USE_MOCK_ADMIN_AUTH) return mockUpdateAdminPassword(payload);
    await apiClient.post<ApiResponse<null>>('/admin/change-password', payload);
  },
};

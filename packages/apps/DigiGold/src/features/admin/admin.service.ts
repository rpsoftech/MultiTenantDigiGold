import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api.types';
import type {
  AdminStats,
  AdminTransaction,
  AdminUserSummary,
  TransactionStats,
  UpdateKycStatusPayload,
} from './admin.types';
import {
  mockGetAdminStats,
  mockGetAdminUsers,
  mockGetRecentTransactions,
  mockGetRecentUsers,
  mockGetTransactionStats,
  mockGetUserTransactions,
  mockUpdateKycStatus,
} from './admin.mock';

const USE_MOCK_ADMIN = process.env.NEXT_PUBLIC_USE_MOCK_ADMIN === 'true';

export const adminService = {
  getAdminStats: async (): Promise<AdminStats> => {
    if (USE_MOCK_ADMIN) return mockGetAdminStats();
    const response = await apiClient.get<ApiResponse<AdminStats>>('/admin/stats');
    return response.data.data;
  },

  getAdminUsers: async (): Promise<AdminUserSummary[]> => {
    if (USE_MOCK_ADMIN) return mockGetAdminUsers();
    const response = await apiClient.get<ApiResponse<AdminUserSummary[]>>('/admin/users');
    return response.data.data;
  },

  getUserTransactions: async (userId: string): Promise<AdminTransaction[]> => {
    if (USE_MOCK_ADMIN) return mockGetUserTransactions(userId);
    const response = await apiClient.get<ApiResponse<AdminTransaction[]>>(
      `/admin/users/${userId}/transactions`
    );
    return response.data.data;
  },

  getTransactionStats: async (): Promise<TransactionStats> => {
    if (USE_MOCK_ADMIN) return mockGetTransactionStats();
    const response = await apiClient.get<ApiResponse<TransactionStats>>('/admin/stats/transactions');
    return response.data.data;
  },

  getRecentTransactions: async (): Promise<AdminTransaction[]> => {
    if (USE_MOCK_ADMIN) return mockGetRecentTransactions();
    const response = await apiClient.get<ApiResponse<AdminTransaction[]>>(
      '/admin/transactions/recent'
    );
    return response.data.data;
  },

  getRecentUsers: async (): Promise<AdminUserSummary[]> => {
    if (USE_MOCK_ADMIN) return mockGetRecentUsers();
    const response = await apiClient.get<ApiResponse<AdminUserSummary[]>>('/admin/users/recent');
    return response.data.data;
  },

  updateKycStatus: async ({
    userId,
    kycStatus,
  }: UpdateKycStatusPayload): Promise<AdminUserSummary> => {
    if (USE_MOCK_ADMIN) return mockUpdateKycStatus(userId, kycStatus);
    const response = await apiClient.patch<ApiResponse<AdminUserSummary>>(
      `/admin/users/${userId}/kyc-status`,
      { kycStatus }
    );
    return response.data.data;
  },
};

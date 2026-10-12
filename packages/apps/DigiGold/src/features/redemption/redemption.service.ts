import { apiClient } from '@/lib/api/client';
import type {
  CancelRedemptionResult,
  CreateRedemptionPayload,
  CreateRedemptionResult,
  RedemptionListParams,
  RedemptionListResult,
} from './redemption.types';

export const redemptionService = {
  create: async (
    payload: CreateRedemptionPayload,
  ): Promise<CreateRedemptionResult> => {
    const response = await apiClient.post<CreateRedemptionResult>(
      '/trade/redeem',
      payload,
    );
    return response.data;
  },

  list: async (
    params: RedemptionListParams = {},
  ): Promise<RedemptionListResult> => {
    const response = await apiClient.get<RedemptionListResult>(
      '/trade/redemptions',
      { params },
    );
    return response.data;
  },

  cancel: async (redemptionUuid: string): Promise<CancelRedemptionResult> => {
    const response = await apiClient.post<CancelRedemptionResult>(
      `/trade/redemptions/${encodeURIComponent(redemptionUuid)}/cancel`,
    );
    return response.data;
  },
};

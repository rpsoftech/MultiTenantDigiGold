import { apiClient } from '@/lib/api/client';
import type {
  InitiateBuyPayload,
  InitiateBuyResult,
  TradeHistoryParams,
  TradeHistoryResult,
} from './trade.types';

export const tradeService = {
  initiateBuy: async (payload: InitiateBuyPayload): Promise<InitiateBuyResult> => {
    const response = await apiClient.post<InitiateBuyResult>('/trade/buy/initiate', payload);
    return response.data;
  },

  getHistory: async (params: TradeHistoryParams = {}): Promise<TradeHistoryResult> => {
    const response = await apiClient.get<TradeHistoryResult>('/trade/history', { params });
    return response.data;
  },
};

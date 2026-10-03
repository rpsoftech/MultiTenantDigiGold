// NOTE: candidate for @digigold/core, mirrors MainServer's redemption DTOs (see
// MainServerGo/internal/models/redemption_request.go and
// internal/api/trade/customer_trade_controller.go Redeem/Redemptions/CancelRedemption).

export type RedemptionStatus = 'PENDING' | 'COLLECTED' | 'CANCELLED';

export type Redemption = {
  redemption_uuid: string;
  ledger_uuid?: string;
  weight_grams: number;
  status: RedemptionStatus;
  pickup_code?: string;
  collected_at?: string;
  cancelled_at?: string;
  created_at: string;
};

export type CreateRedemptionPayload = {
  weight_grams: number;
};

export type CreateRedemptionResult = {
  success: boolean;
  redemption: Redemption;
  message: string;
};

export type RedemptionListParams = {
  page?: number;
  limit?: number;
};

export type RedemptionListResult = {
  success: boolean;
  data: Redemption[];
  page: number;
  limit: number;
};

export type CancelRedemptionResult = {
  success: boolean;
  message: string;
};

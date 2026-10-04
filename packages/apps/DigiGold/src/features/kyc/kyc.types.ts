import type { KycStatus } from '@/store/session/session.types';

// NOTE: candidate for @digigold/core — mirrors MainServer's POST /user/kyc body. Only these
// two fields are accepted; the server validates and normalises them too.
export type SubmitKycPayload = {
  pan_number: string;
  aadhaar_last4: string;
};

export type SubmitKycResult = {
  success: boolean;
  message: string;
};

// GET /user/kyc. 'not_started' is derived server-side: the DB defaults every new user to
// 'pending', so a pending row with no submitted documents is reported as not_started.
export type KycStatusResult = {
  success: boolean;
  kyc_status: KycStatus;
};

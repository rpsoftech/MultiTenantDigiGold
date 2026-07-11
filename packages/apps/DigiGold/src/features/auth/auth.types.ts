import type { SessionUser } from '@/store/session/session.types';

// NOTE: candidate for @digigold/core — mirrors MainServer's expected auth request/response
// shapes; move it there once packages/libs/core is built and importable.

export type RequestOtpPayload = {
  mobileNumber: string;
};

export type RequestOtpResult = {
  otpSent: boolean;
  resendAfterSeconds: number;
};

export type VerifyOtpPayload = {
  mobileNumber: string;
  otp: string;
};

export type VerifyOtpResult = {
  user: SessionUser;
};

export type CompleteProfilePayload = {
  fullName: string;
  dateOfBirth: string; // TODO: confirm exact wire format with backend
  city: string;
};

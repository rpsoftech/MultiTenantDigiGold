import type {
  RequestOtpPayload,
  RequestOtpResult,
  VerifyOtpPayload,
  VerifyOtpResult,
  CompleteProfilePayload,
} from './auth.types';

// MainServer's OTP endpoints aren't ready yet — every mobile number "sends" successfully,
// and "123456" is the one OTP that verifies. Swapping to the real calls in auth.service.ts
// is a one-line change (flip USE_MOCK_AUTH).
const MOCK_VALID_OTP = '123456';

export async function mockRequestOtp(_payload: RequestOtpPayload): Promise<RequestOtpResult> {
  return { otpSent: true, resendAfterSeconds: 30 };
}

export async function mockVerifyOtp(payload: VerifyOtpPayload): Promise<VerifyOtpResult> {
  if (payload.otp !== MOCK_VALID_OTP) {
    throw new Error('Incorrect OTP. Please try again.');
  }
  return {
    user: {
      userId: 'mock-user-1',
      mobileNumber: payload.mobileNumber,
      isNewUser: true,
      kycStatus: 'not_started',
    },
  };
}

export async function mockCompleteProfile(_payload: CompleteProfilePayload): Promise<void> {
  return;
}

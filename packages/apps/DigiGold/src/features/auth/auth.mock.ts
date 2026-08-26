import type {
  RequestOtpPayload,
  RequestOtpResult,
  VerifyOtpPayload,
  VerifyOtpResult,
  CompleteProfilePayload,
} from './auth.types';

// Local-only auth fallback: every mobile number "sends" successfully, and "123456" is
// the one OTP that verifies. Flip NEXT_PUBLIC_USE_MOCK_AUTH to use this instead of MainServer.
const MOCK_VALID_OTP = '123456';

export async function mockRequestOtp(
  _payload: RequestOtpPayload,
): Promise<RequestOtpResult> {
  return { success: true, message: 'OTP sent', is_registered: false };
}

export async function mockVerifyOtp(
  payload: VerifyOtpPayload,
): Promise<VerifyOtpResult> {
  if (payload.otp !== MOCK_VALID_OTP) {
    throw new Error('Incorrect OTP. Please try again.');
  }
  return {
    success: true,
    message: 'OTP verified',
    is_registered: false,
    registration_token: 'mock-registration-token',
  };
}

export async function mockCompleteProfile(
  _payload: CompleteProfilePayload,
): Promise<VerifyOtpResult> {
  return {
    success: true,
    message: 'Registered',
    is_registered: true,
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
  };
}

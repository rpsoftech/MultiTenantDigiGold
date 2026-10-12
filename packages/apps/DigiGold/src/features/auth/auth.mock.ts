import type {
  RequestOtpPayload,
  RequestOtpResult,
  VerifyOtpPayload,
  VerifyOtpResult,
  CompleteProfilePayload,
} from './auth.types';
import { decodeJwtPayload } from '@/lib/utils/jwt';

// Local-only auth fallback: every mobile number "sends" successfully, and "123456" is
// the one OTP that verifies. Flip NEXT_PUBLIC_USE_MOCK_AUTH to use this instead of MainServer.
const MOCK_VALID_OTP = '123456';

function base64Url(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// An unsigned JWT-shaped token: the app decodes token claims (user id, phone, expiry) to
// restore the session, so plain strings like "mock-access-token" signed the mock user out
// on the next page load.
function mockJwt(claims: Record<string, unknown>): string {
  const exp = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
  return [
    base64Url(JSON.stringify({ alg: 'none', typ: 'JWT' })),
    base64Url(JSON.stringify({ exp, ...claims })),
    'mock',
  ].join('.');
}

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
    registration_token: mockJwt({ phone: payload.mobileNumber }),
  };
}

export async function mockCompleteProfile(
  payload: CompleteProfilePayload,
): Promise<VerifyOtpResult> {
  const phone =
    decodeJwtPayload<{ phone?: string }>(payload.registrationToken)?.phone ??
    '';
  return {
    success: true,
    message: 'Registered',
    is_registered: true,
    access_token: mockJwt({ user_uuid: 'mock-user', phone }),
    refresh_token: mockJwt({ user_uuid: 'mock-user' }),
  };
}

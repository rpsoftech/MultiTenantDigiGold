import {
  clearRegistrationToken,
  clearTokens,
  getAccessToken,
  getRefreshToken,
  getRegistrationToken,
} from '@/lib/auth/tokenStorage';
import { decodeJwtPayload, isJwtExpired } from '@/lib/utils/jwt';
import type { SessionUser } from '@/store/session/session.types';

// See internal/service/jwt.go UserClaims on MainServer — customer access tokens carry
// user_uuid/tenant_uuid/phone, nothing else the UI needs at boot (kyc_status isn't in the
// token; screens that need it fetch it from the real endpoint once mounted).
type UserAccessTokenClaims = { user_uuid: string; phone: string };

// Called once on app mount to turn the stored tokens back into Redux session state after a
// full page refresh. An expired access token is fine while the refresh token is still
// valid: apiClient renews it on the first request. Returns null if there's nothing to
// restore (never logged in) or the session can't be renewed — in that second case it also
// clears the stale tokens so they aren't retried on every request.
export function restoreSessionUser(): SessionUser | null {
  const accessToken = getAccessToken();
  if (!accessToken) return null;

  const refreshToken = getRefreshToken();
  const renewable = refreshToken !== null && !isJwtExpired(refreshToken);
  if (isJwtExpired(accessToken) && !renewable) {
    clearTokens();
    return null;
  }

  const claims = decodeJwtPayload<UserAccessTokenClaims>(accessToken);
  if (!claims) {
    clearTokens();
    return null;
  }

  return {
    userId: claims.user_uuid,
    role: 'customer',
    mobileNumber: claims.phone,
    isNewUser: false,
    kycStatus: 'not_started',
  };
}

// MainServer's RegistrationClaims (10-minute token handed out by /auth/otp/verify for a new
// number).
type RegistrationTokenClaims = { phone?: string };

// Restores a sign-up in progress (OTP verified, profile not yet completed) after a page
// refresh, so /profile-setup doesn't bounce the customer back to the login page. The
// registration token lives in sessionStorage and carries the phone number.
export function restoreRegistration(): { token: string; phone: string } | null {
  const token = getRegistrationToken();
  if (!token) return null;
  const claims = decodeJwtPayload<RegistrationTokenClaims>(token);
  if (isJwtExpired(token) || !claims?.phone) {
    clearRegistrationToken();
    return null;
  }
  return { token, phone: claims.phone };
}

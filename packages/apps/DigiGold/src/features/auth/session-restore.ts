import { getAccessToken, clearTokens } from '@/lib/auth/tokenStorage';
import { decodeJwtPayload, isJwtExpired } from '@/lib/utils/jwt';
import { getStoredKycStatus } from '@/features/kyc/kyc-status-storage';
import type { SessionUser } from '@/store/session/session.types';

// See internal/service/jwt.go UserClaims on MainServer — customer access tokens carry
// user_uuid/tenant_uuid/phone, nothing else the UI needs at boot (kyc_status isn't in the
// token; screens that need it fetch it from the real endpoint once mounted).
type UserAccessTokenClaims = { user_uuid: string; phone: string };

// Called once on app mount to turn a still-valid stored access token back into Redux
// session state after a full page refresh. Returns null if there's nothing to restore
// (never logged in) or the stored token turned out to be expired/malformed — in that
// second case it also clears the stale token so it isn't retried on every request.
export function restoreSessionUser(): SessionUser | null {
  const accessToken = getAccessToken();
  if (!accessToken) return null;

  if (isJwtExpired(accessToken)) {
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
    kycStatus: getStoredKycStatus(claims.user_uuid),
  };
}

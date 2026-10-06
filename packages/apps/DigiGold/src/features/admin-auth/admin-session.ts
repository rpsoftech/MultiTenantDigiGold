import { decodeJwtPayload } from '@/lib/utils/jwt';
import type { SessionUser } from '@/store/session/session.types';

// Decoding is only for UI session restoration. The backend verifies the JWT
// signature, role permissions, and tenant scope on every protected request.
export function adminSessionUser(accessToken: string): SessionUser {
  const claims = decodeJwtPayload<Record<string, unknown>>(accessToken);
  const { admin_uuid, role, aud, exp, username } = claims ?? {};
  const audiences = Array.isArray(aud) ? aud : [aud];

  if (
    typeof admin_uuid !== 'string' ||
    !admin_uuid.trim() ||
    typeof role !== 'string' ||
    !role.trim() ||
    !audiences.includes('digigold:admin:access') ||
    typeof exp !== 'number' ||
    !Number.isFinite(exp) ||
    exp <= Date.now() / 1000
  ) {
    throw new Error(
      'Your admin session is invalid or expired. Please sign in again.',
    );
  }

  return {
    userId: admin_uuid,
    role: 'admin',
    adminRole: role,
    // Display only: shown in the admin menu. Older tokens don't carry it.
    ...(typeof username === 'string' && username.trim()
      ? { name: username }
      : {}),
    isNewUser: false,
    kycStatus: 'not_started',
  };
}

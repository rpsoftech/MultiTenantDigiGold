import type { SessionUser } from '@/store/session/session.types';

// Decoding is only for UI session restoration. The backend verifies the JWT
// signature, role permissions, and tenant scope on every protected request.
export function adminSessionUser(accessToken: string): SessionUser {
  try {
    const parts = accessToken.split('.');
    if (
      parts.length !== 3 ||
      parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))
    ) {
      throw new Error('Malformed token');
    }

    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(
      payload.padEnd(Math.ceil(payload.length / 4) * 4, '='),
    );
    const claims: unknown = JSON.parse(
      decodeURIComponent(
        Array.from(
          decoded,
          (character) =>
            `%${character.charCodeAt(0).toString(16).padStart(2, '0')}`,
        ).join(''),
      ),
    );
    if (typeof claims !== 'object' || claims === null) {
      throw new Error('Missing claims');
    }

    const { admin_uuid, role, aud, exp } = claims as Record<string, unknown>;
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
      throw new Error('Invalid admin claims');
    }

    return {
      userId: admin_uuid,
      role: 'admin',
      isNewUser: false,
      kycStatus: 'not_started',
    };
  } catch {
    throw new Error(
      'Your admin session is invalid or expired. Please sign in again.',
    );
  }
}

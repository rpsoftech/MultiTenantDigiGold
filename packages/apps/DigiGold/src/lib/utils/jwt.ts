// Client-side JWT payload reading only — never verifies the signature (the browser has no
// way to, and shouldn't try to). Used purely for UX: showing the right user info before a
// real request round-trips, and pre-emptively treating an obviously expired token as
// logged-out. MainServer is still the only source of truth for whether a token is valid.

function base64UrlDecode(segment: string): string {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/').padEnd(
    segment.length + ((4 - (segment.length % 4)) % 4),
    '='
  );
  return typeof window === 'undefined'
    ? Buffer.from(padded, 'base64').toString('utf-8')
    : window.atob(padded);
}

export function decodeJwtPayload<T>(token: string): T | null {
  const segments = token.split('.');
  if (segments.length !== 3) return null;
  try {
    return JSON.parse(base64UrlDecode(segments[1])) as T;
  } catch {
    return null;
  }
}

export function isJwtExpired(token: string): boolean {
  const payload = decodeJwtPayload<{ exp?: number }>(token);
  if (!payload?.exp) return false;
  return Date.now() >= payload.exp * 1000;
}

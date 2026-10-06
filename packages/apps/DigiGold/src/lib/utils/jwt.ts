// Client-side JWT payload reading only — never verifies the signature (the browser has no
// way to, and shouldn't try to). Used purely for UX: showing the right user info before a
// real request round-trips, and pre-emptively treating an obviously expired token as
// logged-out. MainServer is still the only source of truth for whether a token is valid.

const BASE64URL_SEGMENT = /^[A-Za-z0-9_-]+$/;

// Decodes a base64url segment as UTF-8. Plain atob() returns one character per byte, which
// garbles any non-ASCII claim (e.g. a name with "é" or Devanagari text).
function base64UrlDecode(segment: string): string {
  const padded = segment
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(segment.length + ((4 - (segment.length % 4)) % 4), '=');

  if (typeof window === 'undefined') {
    return Buffer.from(padded, 'base64').toString('utf-8');
  }
  const binary = window.atob(padded);
  return decodeURIComponent(
    Array.from(
      binary,
      (char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`,
    ).join(''),
  );
}

export function decodeJwtPayload<T>(token: string): T | null {
  const segments = token.split('.');
  if (
    segments.length !== 3 ||
    !segments.every((part) => BASE64URL_SEGMENT.test(part))
  ) {
    return null;
  }
  try {
    const payload: unknown = JSON.parse(base64UrlDecode(segments[1]));
    return typeof payload === 'object' && payload !== null
      ? (payload as T)
      : null;
  } catch {
    return null;
  }
}

export function isJwtExpired(token: string): boolean {
  const payload = decodeJwtPayload<{ exp?: number }>(token);
  if (!payload?.exp) return false;
  return Date.now() >= payload.exp * 1000;
}

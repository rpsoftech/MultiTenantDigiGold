// Single owner of the persisted auth token. MainServer's JWT is the only proof of a session,
// so every read/write goes through here rather than sprinkling localStorage keys across the
// API client, the auth service and the store bootstrap. Lives in lib/ (not features/auth)
// because lib/api consumes it too.

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

function readItem(key: string): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(key);
}

function writeItem(key: string, value: string | undefined) {
  if (typeof window === 'undefined' || !value) return;
  window.localStorage.setItem(key, value);
}

export function readStoredAccessToken(): string | null {
  return readItem(ACCESS_TOKEN_KEY);
}

export function readStoredRefreshToken(): string | null {
  return readItem(REFRESH_TOKEN_KEY);
}

// Only the non-null tokens are written, so a partial response can never erase a token the
// user still holds; use clearStoredTokens() for an explicit sign-out.
export function persistTokens(tokens: {
  accessToken?: string;
  refreshToken?: string;
}) {
  writeItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  writeItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export function clearStoredTokens() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

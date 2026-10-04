// Single source of truth for where auth tokens live in browser storage. Nothing outside
// this module should call localStorage/sessionStorage for these keys directly.

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const REGISTRATION_TOKEN_KEY = 'registration_token';

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(tokens: { accessToken?: string; refreshToken?: string }): void {
  if (typeof window === 'undefined') return;
  if (tokens.accessToken) window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  if (tokens.refreshToken) window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export function clearTokens(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function getRegistrationToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem(REGISTRATION_TOKEN_KEY);
}

export function setRegistrationToken(token: string): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(REGISTRATION_TOKEN_KEY, token);
}

export function clearRegistrationToken(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(REGISTRATION_TOKEN_KEY);
}

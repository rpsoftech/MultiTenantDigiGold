export type AdminTokens = {
  access_token: string;
  refresh_token: string;
};

let tokenRevision = 0;

export function getAdminAccessToken(): string | null {
  return typeof window === 'undefined'
    ? null
    : window.localStorage.getItem('admin_access_token');
}

export function getAdminRefreshToken(): string | null {
  return typeof window === 'undefined'
    ? null
    : window.localStorage.getItem('admin_refresh_token');
}

export function getAdminSessionId(): string | null {
  return typeof window === 'undefined'
    ? null
    : window.localStorage.getItem('admin_session_id');
}

export function storeAdminTokens(tokens: AdminTokens): void {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem('admin_session_id', crypto.randomUUID());
  rotateAdminTokens(tokens);
}

export function rotateAdminTokens(tokens: AdminTokens): void {
  if (typeof window === 'undefined') return;

  tokenRevision += 1;
  window.localStorage.setItem('admin_access_token', tokens.access_token);
  window.localStorage.setItem('admin_refresh_token', tokens.refresh_token);
}

export function clearAdminTokens(): void {
  tokenRevision += 1;
  if (typeof window === 'undefined') return;

  window.localStorage.removeItem('admin_access_token');
  window.localStorage.removeItem('admin_refresh_token');
  window.localStorage.removeItem('admin_session_id');
}

// A cleared or replaced session must never be restored by an older refresh.
export function getAdminTokenRevision(): number {
  return tokenRevision;
}

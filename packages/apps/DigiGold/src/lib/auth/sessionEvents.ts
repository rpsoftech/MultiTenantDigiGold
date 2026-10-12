// Lets the transport layer (lib/api/client.ts) signal "the session is no longer valid"
// without importing Redux directly — Providers (app layer) is the one place that turns
// this into a sessionCleared() dispatch + redirect, keeping the layering in 05-API-LAYER.md.

const SESSION_EXPIRED_EVENT = 'digigold:session-expired';

// 'rejected': the server answered a protected request with 401 — the user was mid-action,
// so send them to login. 'expired': the stored token's `exp` passed client-side — clear the
// session quietly, since the request that noticed may be a public one (e.g. live rates on
// the home page) and the visitor shouldn't be yanked off the page they're reading.
export type SessionExpiredReason = 'rejected' | 'expired';

export function emitSessionExpired(reason: SessionExpiredReason): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<SessionExpiredReason>(SESSION_EXPIRED_EVENT, { detail: reason }),
  );
}

export function onSessionExpired(handler: (reason: SessionExpiredReason) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const listener = (event: Event) =>
    handler((event as CustomEvent<SessionExpiredReason>).detail);
  window.addEventListener(SESSION_EXPIRED_EVENT, listener);
  return () => window.removeEventListener(SESSION_EXPIRED_EVENT, listener);
}

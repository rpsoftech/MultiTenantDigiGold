// Lets the transport layer (lib/api/client.ts) signal "the session is no longer valid"
// without importing Redux directly — Providers (app layer) is the one place that turns
// this into a sessionCleared() dispatch + redirect, keeping the layering in 05-API-LAYER.md.

const SESSION_EXPIRED_EVENT = 'digigold:session-expired';

export function emitSessionExpired(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}

export function onSessionExpired(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener(SESSION_EXPIRED_EVENT, handler);
  return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handler);
}

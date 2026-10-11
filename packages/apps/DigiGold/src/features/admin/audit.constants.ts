import type { AuditEvent } from './admin.types';

// MainServer does not expose the list of event names, so the filter offers the ones it writes.
export const AUDIT_EVENT_TYPES = [
  'ADMIN_LOGGED_IN',
  'ADMIN_CREATED',
  'ADMIN_UPDATED',
  'TenantCreated',
  'TenantUpdated',
  'TenantDeleted',
  'TenantConfigUpdated',
  'MARGIN_UPDATED',
  'KYC_DOC_UPLOADED',
  'KYC_DOC_VERIFIED',
  'KYC_DECIDED',
  'TENANT_ACTIVATED',
  'TENANT_UI_LAYOUT_UPDATED',
  'OTPReqEvent',
  'OTPResendEvent',
  'OTPVerifyEvent',
  'TRADE_GOLD_PURCHASE',
  'TRADE_PAYMENT_REFUNDED',
  'TRADE_REDEMPTION_COLLECTED',
] as const;

export function formatAuditTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Kolkata',
  });
}

// Event names mix SHOUTING_CASE and PascalCase, so split both into words.
export function auditEventLabel(eventName: string): string {
  const words = eventName
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replaceAll('_', ' ')
    .trim()
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// MainServer writes TRADE_GOLD_PURCHASE for every ledger movement (purchases, counter sales,
// redemptions, reversals); the payload's event_type says which it was.
const TRADE_LEDGER_EVENT = 'TRADE_GOLD_PURCHASE';
const LEDGER_KIND_LABELS: Record<string, string> = {
  GOLD_PURCHASE: 'Gold purchase',
  PHYSICAL_REDEMPTION: 'Physical redemption',
  SYSTEM_REVERSAL: 'System reversal',
  ADMIN_ADJUSTMENT: 'Admin adjustment',
};

// The name for an event type in the filter.
export function auditEventTypeLabel(eventName: string): string {
  return eventName === TRADE_LEDGER_EVENT
    ? 'Ledger movement (purchase, redemption, reversal)'
    : auditEventLabel(eventName);
}

// What happened, for a row or the drawer: ledger movements by their real kind.
export function auditEventTitle(
  event: Pick<AuditEvent, 'eventName' | 'payload'>,
): string {
  if (event.eventName === TRADE_LEDGER_EVENT) {
    const kind = (event.payload as { event_type?: unknown } | null)?.event_type;
    if (typeof kind === 'string' && kind) {
      return LEDGER_KIND_LABELS[kind] ?? auditEventLabel(kind);
    }
  }
  return auditEventLabel(event.eventName);
}

// Mirrors MainServer's events.RedactPayload, which already masks secrets before sending; this
// second layer keeps a secret off the screen and the clipboard if the server ever misses one.
const SECRET_KEY_PARTS = [
  'secret',
  'token',
  'password',
  'pickup_code',
  'api_key',
  'apikey',
  'authorization',
  'private_key',
];
// Matched whole: "otp" alone would also hide flags like is_totp_enabled.
const SECRET_KEYS = new Set(['otp', 'otpcode', 'otp_code']);
export const REDACTED = '[redacted]';

function isSecretKey(key: string): boolean {
  const lower = key.toLowerCase();
  return (
    SECRET_KEYS.has(lower) ||
    SECRET_KEY_PARTS.some((part) => lower.includes(part))
  );
}

export function redactAuditPayload(
  payload: unknown,
  // Objects on the current path, so a (non-JSON) cycle can't recurse forever.
  seen: WeakSet<object> = new WeakSet(),
): unknown {
  if (payload === null || typeof payload !== 'object') return payload;
  if (seen.has(payload)) return '[circular]';
  seen.add(payload);
  const redacted = Array.isArray(payload)
    ? payload.map((item) => redactAuditPayload(item, seen))
    : Object.fromEntries(
        Object.entries(payload).map(([key, value]) => [
          key,
          isSecretKey(key) && value !== null && value !== ''
            ? REDACTED
            : redactAuditPayload(value, seen),
        ]),
      );
  seen.delete(payload);
  return redacted;
}

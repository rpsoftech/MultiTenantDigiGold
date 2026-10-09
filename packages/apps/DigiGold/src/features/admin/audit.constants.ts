// MainServer does not expose the list of event names, so the filter offers the ones it writes.
export const AUDIT_EVENT_TYPES = [
  'ADMIN_LOGGED_IN',
  'ADMIN_CREATED',
  'ADMIN_UPDATED',
  'TenantCreated',
  'TenantUpdated',
  'TenantConfigUpdated',
  'MARGIN_UPDATED',
  'KYC_DOC_UPLOADED',
  'KYC_DOC_VERIFIED',
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

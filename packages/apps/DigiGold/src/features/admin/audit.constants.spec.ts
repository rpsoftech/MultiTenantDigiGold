import {
  AUDIT_EVENT_TYPES,
  auditEventTitle,
  auditEventTypeLabel,
  redactAuditPayload,
} from './audit.constants';

describe('auditEventTitle', () => {
  it('names a ledger movement by its kind', () => {
    const movement = (eventType: unknown) => ({
      eventName: 'TRADE_GOLD_PURCHASE',
      payload: { event_type: eventType },
    });
    expect(auditEventTitle(movement('GOLD_PURCHASE'))).toBe('Gold purchase');
    expect(auditEventTitle(movement('PHYSICAL_REDEMPTION'))).toBe(
      'Physical redemption',
    );
    expect(auditEventTitle(movement('SYSTEM_REVERSAL'))).toBe(
      'System reversal',
    );
    // An unknown kind is still readable; a missing one falls back to the event name.
    expect(auditEventTitle(movement('BONUS_CREDIT'))).toBe('Bonus credit');
    expect(auditEventTitle(movement(undefined))).toBe('Trade gold purchase');
  });

  it('names other events by their event name', () => {
    expect(auditEventTitle({ eventName: 'KYC_DECIDED', payload: {} })).toBe(
      'Kyc decided',
    );
    expect(auditEventTitle({ eventName: 'TenantDeleted', payload: null })).toBe(
      'Tenant deleted',
    );
  });
});

describe('the event type filter', () => {
  it('offers every event MainServer writes, with ledger movements named as such', () => {
    expect(AUDIT_EVENT_TYPES).toEqual(
      expect.arrayContaining([
        'TenantDeleted',
        'KYC_DECIDED',
        'TRADE_GOLD_PURCHASE',
      ]),
    );
    expect(auditEventTypeLabel('TRADE_GOLD_PURCHASE')).toBe(
      'Ledger movement (purchase, redemption, reversal)',
    );
  });
});

describe('redactAuditPayload', () => {
  it('masks secrets at any depth and keeps everything else', () => {
    expect(
      redactAuditPayload({
        otpCode: '482915',
        phone: '9876543210',
        is_totp_enabled: true,
        payment_config: { key_id: 'rzp_live_x', key_secret: 's3cret' },
        whatsapp: [{ access_token: 'tok', template: 'login' }],
        webhook_secret: '',
      }),
    ).toEqual({
      otpCode: '[redacted]',
      phone: '9876543210',
      is_totp_enabled: true,
      payment_config: { key_id: 'rzp_live_x', key_secret: '[redacted]' },
      whatsapp: [{ access_token: '[redacted]', template: 'login' }],
      webhook_secret: '',
    });
  });

  it('leaves primitives alone and survives a cycle', () => {
    expect(redactAuditPayload('text')).toBe('text');
    expect(redactAuditPayload(null)).toBeNull();
    const circular: Record<string, unknown> = { token: 'x' };
    circular.self = circular;
    expect(redactAuditPayload(circular)).toEqual({
      token: '[redacted]',
      self: '[circular]',
    });
  });
});

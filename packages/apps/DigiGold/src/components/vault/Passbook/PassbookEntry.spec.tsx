import { render, screen } from '@testing-library/react';
import type {
  TradeEventType,
  TradeHistoryEntry,
} from '@/features/trade/trade.types';
import { PassbookEntry } from './PassbookEntry';

function makeEntry(
  overrides: Partial<TradeHistoryEntry> = {},
): TradeHistoryEntry {
  return {
    gl_uuid: 'gl-1',
    event_type: 'GOLD_PURCHASE',
    payment_mode: 'ONLINE_PG',
    weight_grams: 1.5,
    total_amount_inr: 10500,
    running_gold_balance_grams: 4.25,
    final_rate_per_gram: 7000,
    reference_id: 'pay_abc123',
    created_at: '2026-10-01T10:00:00Z',
    ...overrides,
  };
}

describe('PassbookEntry', () => {
  it('shows the weight, amount, rate and running balance', () => {
    render(<PassbookEntry entry={makeEntry()} />);

    expect(screen.getByText('+1.5000 g')).toBeTruthy();
    expect(screen.getByText('₹10,500')).toBeTruthy();
    expect(screen.getByText('₹7,000/g')).toBeTruthy();
    expect(screen.getByText('4.2500 g')).toBeTruthy();
  });

  it('shows the payment reference', () => {
    render(<PassbookEntry entry={makeEntry()} />);

    expect(screen.getByText('pay_abc123')).toBeTruthy();
  });

  it('falls back to a dash when there is no reference', () => {
    render(<PassbookEntry entry={makeEntry({ reference_id: undefined })} />);

    expect(screen.getByText('—')).toBeTruthy();
  });

  it('shows gold leaving the vault with a minus sign and no plus', () => {
    render(
      <PassbookEntry
        entry={makeEntry({
          event_type: 'PHYSICAL_REDEMPTION',
          weight_grams: -2,
        })}
      />,
    );

    expect(screen.getByText('-2.0000 g')).toBeTruthy();
    expect(screen.queryByText(/^\+/)).toBeNull();
  });

  it('shows a zero change as an addition', () => {
    render(<PassbookEntry entry={makeEntry({ weight_grams: 0 })} />);

    expect(screen.getByText('+0.0000 g')).toBeTruthy();
  });

  it.each<[TradeEventType, string]>([
    ['GOLD_PURCHASE', 'Gold Purchase'],
    ['PHYSICAL_REDEMPTION', 'Physical Redemption'],
    ['SYSTEM_REVERSAL', 'System Reversal'],
    ['ADMIN_ADJUSTMENT', 'Admin Adjustment'],
  ])('labels %s as %s', (eventType, label) => {
    render(<PassbookEntry entry={makeEntry({ event_type: eventType })} />);

    expect(screen.getByText(label)).toBeTruthy();
  });

  it('shows an unrecognised event type as it is', () => {
    render(
      <PassbookEntry
        entry={makeEntry({ event_type: 'SOMETHING_NEW' as TradeEventType })}
      />,
    );

    expect(screen.getByText('SOMETHING_NEW')).toBeTruthy();
  });

  it.each([
    ['ONLINE_PG', 'Online Payment'],
    ['COUNTER_CASH', 'Store Cash'],
    ['COUNTER_UPI', 'Store UPI'],
    ['NONE', 'N/A'],
  ])('shows payment mode %s as %s', (mode, label) => {
    render(<PassbookEntry entry={makeEntry({ payment_mode: mode })} />);

    expect(screen.getByText(label)).toBeTruthy();
  });

  it('shows an unknown payment mode unchanged', () => {
    render(<PassbookEntry entry={makeEntry({ payment_mode: 'CRYPTO' })} />);

    expect(screen.getByText('CRYPTO')).toBeTruthy();
  });

  it('shows the date in Indian format', () => {
    render(<PassbookEntry entry={makeEntry()} />);

    const expected = new Date('2026-10-01T10:00:00Z').toLocaleString('en-IN');
    expect(screen.getByText(expected)).toBeTruthy();
  });
});

import { afterEach, describe, expect, it } from '@jest/globals';
import { cleanup, render, screen, within } from '@testing-library/react';
import type { AdminLedgerEntry } from '@/features/admin/admin.types';
import { StoreLedgerTable } from './StoreLedgerTable';

const purchase: AdminLedgerEntry = {
  id: 'ledger-purchase',
  eventType: 'GOLD_PURCHASE',
  paymentMode: 'COUNTER_UPI',
  weightGrams: 1.25,
  amountInr: 10000.5,
  runningGoldBalanceGrams: 3.75,
  timestamp: '2026-01-02T00:00:00.000Z',
  referenceId: 'payment-reference',
  isReversed: false,
};

afterEach(cleanup);

describe('StoreLedgerTable', () => {
  it('shows signed movement, exact currency and the customer balance after the entry', () => {
    render(<StoreLedgerTable entries={[purchase]} />);

    expect(screen.getByText('+1.2500 g')).toBeTruthy();
    expect(screen.getByText('₹10,000.50')).toBeTruthy();
    expect(screen.getByText('3.7500 g')).toBeTruthy();
    expect(screen.getByText('Counter · UPI')).toBeTruthy();
    expect(screen.getByText('Ref: payment-reference')).toBeTruthy();
    expect(screen.getByText('Recorded')).toBeTruthy();
    expect(screen.queryByRole('columnheader', { name: 'User' })).toBeNull();
  });

  it('distinguishes a reversed original from the reversal and preserves negative values', () => {
    render(
      <StoreLedgerTable
        entries={[
          { ...purchase, isReversed: true },
          {
            ...purchase,
            id: 'ledger-reversal',
            eventType: 'SYSTEM_REVERSAL',
            paymentMode: 'NONE',
            weightGrams: -1.25,
            amountInr: -10000.5,
            runningGoldBalanceGrams: 2.5,
            referenceId: 'REVERSAL_ledger-purchase',
            reversesLedgerId: 'ledger-purchase',
          },
        ]}
      />,
    );

    const rows = screen.getAllByRole('row');
    expect(within(rows[1]).getByText('Reversed')).toBeTruthy();
    expect(within(rows[2]).getByText('Reversal')).toBeTruthy();
    expect(within(rows[2]).getByText('Reverses: ledger-purchase')).toBeTruthy();
    expect(within(rows[2]).getByText('-1.2500 g')).toBeTruthy();
    expect(within(rows[2]).getByText('-₹10,000.50')).toBeTruthy();
    expect(within(rows[2]).getByText('No payment')).toBeTruthy();
  });

  it('keeps unknown event and payment modes readable without inventing a status', () => {
    render(
      <StoreLedgerTable
        entries={[
          {
            ...purchase,
            eventType: 'OTHER_MOVEMENT',
            paymentMode: 'OTHER_MODE',
          },
        ]}
      />,
    );

    expect(screen.getByText('Other movement')).toBeTruthy();
    expect(screen.getByText('Other mode')).toBeTruthy();
    expect(screen.getByText('Recorded')).toBeTruthy();
  });
});

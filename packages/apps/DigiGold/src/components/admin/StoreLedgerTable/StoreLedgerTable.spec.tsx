import { afterEach, describe, expect, it } from '@jest/globals';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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

  it('hides the actions column unless a reverse handler is provided', () => {
    render(<StoreLedgerTable entries={[purchase]} />);

    expect(screen.queryByRole('button', { name: /Reverse/ })).toBeNull();
    expect(screen.queryByRole('columnheader', { name: 'Actions' })).toBeNull();
  });

  it('enables Reverse only for entries that can be reversed', () => {
    const onReverse = jest.fn();
    render(
      <StoreLedgerTable
        entries={[
          purchase,
          { ...purchase, id: 'already', isReversed: true },
          {
            ...purchase,
            id: 'reversal',
            eventType: 'SYSTEM_REVERSAL',
            reversesLedgerId: 'already',
          },
        ]}
        onReverse={onReverse}
      />,
    );

    const open = screen.getByRole('button', {
      name: 'Reverse ledger entry ledger-purchase',
    }) as HTMLButtonElement;
    const reversed = screen.getByRole('button', {
      name: 'Reverse ledger entry already',
    }) as HTMLButtonElement;
    const reversal = screen.getByRole('button', {
      name: 'Reverse ledger entry reversal',
    }) as HTMLButtonElement;

    expect(open.disabled).toBe(false);
    expect(reversed.disabled).toBe(true);
    expect(reversal.disabled).toBe(true);
    fireEvent.click(reversed);
    fireEvent.click(reversal);
    expect(onReverse).not.toHaveBeenCalled();
    fireEvent.click(open);
    expect(onReverse).toHaveBeenCalledWith(purchase);
  });

  it('blocks the row that is being reversed', () => {
    render(
      <StoreLedgerTable
        entries={[purchase]}
        onReverse={jest.fn()}
        reversingId="ledger-purchase"
      />,
    );

    expect(
      (
        screen.getByRole('button', {
          name: 'Reverse ledger entry ledger-purchase',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});

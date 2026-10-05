import { afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useToast } from '@/components/common/Toast/Toast';
import { redemptionService } from '@/features/redemption/redemption.service';
import { RedeemFlow } from './RedeemFlow';
import { stubMatchMedia, withProviders } from './testUtils';

jest.mock('@/components/common/Toast/Toast', () => ({ useToast: jest.fn() }));
jest.mock('@/features/redemption/redemption.service', () => ({
  redemptionService: { create: jest.fn(), list: jest.fn(), cancel: jest.fn() },
}));

const showToast = jest.fn();

beforeAll(stubMatchMedia);
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useToast).mockReturnValue({ showToast });
});
afterEach(cleanup);

function gramsInput() {
  return screen.getByLabelText<HTMLInputElement>('Weight to redeem (grams)');
}

async function continueWith(grams: string) {
  fireEvent.change(gramsInput(), { target: { value: grams } });
  const button = screen.getByRole<HTMLButtonElement>('button', { name: 'Continue' });
  await waitFor(() => expect(button.disabled).toBe(false));
  fireEvent.click(button);
  await screen.findByText('Confirm redemption');
}

describe('RedeemFlow', () => {
  it('explains how pickup works', () => {
    render(withProviders(<RedeemFlow balanceGrams={12.5} />));
    expect(screen.getByRole('region', { name: 'How pickup works' })).toBeTruthy();
    expect(screen.getByText('Collect it in store')).toBeTruthy();
  });

  it('sends an empty vault to buy gold instead of showing the form', () => {
    render(withProviders(<RedeemFlow balanceGrams={0} />));
    expect(screen.getByText(/Your vault is empty/)).toBeTruthy();
    expect(screen.queryByLabelText('Weight to redeem (grams)')).toBeNull();
  });

  it('fills Max with the balance rounded down to 4 decimals', async () => {
    render(withProviders(<RedeemFlow balanceGrams={2.123456} />));
    fireEvent.click(screen.getByRole('button', { name: 'Max' }));
    await waitFor(() => expect(gramsInput().value).toBe('2.1234'));
  });

  it('rejects more than the vault holds', async () => {
    render(withProviders(<RedeemFlow balanceGrams={1} />));
    fireEvent.change(gramsInput(), { target: { value: '1.5' } });
    expect(await screen.findByText('You can redeem up to 1.0000 g')).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Continue' }).disabled).toBe(true);
  });

  it('confirms, debits through the API and shows the pickup code', async () => {
    jest.mocked(redemptionService.create).mockResolvedValue({
      success: true,
      message: 'ok',
      redemption: {
        redemption_uuid: 'r-1',
        weight_grams: 1.25,
        status: 'PENDING',
        pickup_code: '482913',
        created_at: '2026-10-04T10:00:00Z',
      },
    });
    render(withProviders(<RedeemFlow balanceGrams={3} />));

    await continueWith('1.25');
    expect(screen.getByText('1.2500 g')).toBeTruthy(); // gold to collect
    expect(screen.getByText('1.7500 g')).toBeTruthy(); // vault balance after
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(await screen.findByText('Redemption requested')).toBeTruthy();
    expect(screen.getByText('482913')).toBeTruthy();
    expect(jest.mocked(redemptionService.create).mock.calls[0][0]).toEqual({ weight_grams: 1.25 });
  });

  it("shows the server's reason when the redemption is refused", async () => {
    jest.mocked(redemptionService.create).mockRejectedValue({
      message: 'Insufficient vault balance',
      code: 'INSUFFICIENT_BALANCE',
      status: 400,
    });
    render(withProviders(<RedeemFlow balanceGrams={3} />));

    await continueWith('1');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'danger', description: 'Insufficient vault balance' }),
      ),
    );
    expect(screen.queryByText('Redemption requested')).toBeNull();
  });
});

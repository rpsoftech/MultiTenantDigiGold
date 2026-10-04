import { afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useToast } from '@/components/common/Toast/Toast';
import { redemptionService } from '@/features/redemption/redemption.service';
import type { Redemption } from '@/features/redemption/redemption.types';
import { RedemptionCard } from './RedemptionCard';
import { stubMatchMedia, withProviders } from './testUtils';

jest.mock('@/components/common/Toast/Toast', () => ({ useToast: jest.fn() }));
jest.mock('@/features/redemption/redemption.service', () => ({
  redemptionService: { create: jest.fn(), list: jest.fn(), cancel: jest.fn() },
}));

const showToast = jest.fn();
const PENDING: Redemption = {
  redemption_uuid: 'r-1',
  weight_grams: 2,
  status: 'PENDING',
  pickup_code: '482913',
  created_at: '2026-10-04T10:00:00Z',
};

beforeAll(stubMatchMedia);
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useToast).mockReturnValue({ showToast });
});
afterEach(cleanup);

async function cancelViaDialog() {
  fireEvent.click(screen.getByRole('button', { name: 'Cancel redemption' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Yes, cancel' }));
}

describe('RedemptionCard', () => {
  it('shows the pickup code and cancel action only while pending', () => {
    const view = render(withProviders(<RedemptionCard redemption={PENDING} />));
    expect(screen.getByText('482913')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel redemption' })).toBeTruthy();

    view.rerender(
      withProviders(
        <RedemptionCard
          redemption={{ ...PENDING, status: 'COLLECTED', collected_at: '2026-10-04T12:00:00Z' }}
        />,
      ),
    );
    expect(screen.queryByText('482913')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancel redemption' })).toBeNull();
  });

  it('cancels after confirmation', async () => {
    jest.mocked(redemptionService.cancel).mockResolvedValue({ success: true, message: 'ok' });
    render(withProviders(<RedemptionCard redemption={PENDING} />));

    await cancelViaDialog();

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'success', title: 'Redemption cancelled' }),
      ),
    );
    expect(jest.mocked(redemptionService.cancel).mock.calls[0][0]).toBe('r-1');
  });

  it('explains when the redemption was already collected or cancelled', async () => {
    jest.mocked(redemptionService.cancel).mockRejectedValue({
      message: 'Redemption is not pending',
      code: 'REDEMPTION_NOT_PENDING',
      status: 409,
    });
    render(withProviders(<RedemptionCard redemption={PENDING} />));

    await cancelViaDialog();

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'danger',
          title: 'This redemption can no longer be cancelled',
          description: 'Redemption is not pending',
        }),
      ),
    );
  });
});

// Per-status views and cancel edge cases of RedemptionCard. The pending view, cancelling and
// the already-collected/cancelled conflict are in RedemptionCard.spec.tsx.
import { fireEvent, screen } from '@testing-library/react';
import { installMatchMedia, renderWithProviders } from '@/test-utils/renderWithProviders';
import { redemptionService } from '@/features/redemption/redemption.service';
import type { Redemption } from '@/features/redemption/redemption.types';
import { RedemptionCard } from './RedemptionCard';

jest.mock('@/features/redemption/redemption.service', () => ({
  redemptionService: { create: jest.fn(), list: jest.fn(), cancel: jest.fn() },
}));

const mockedService = redemptionService as jest.Mocked<typeof redemptionService>;

const pending: Redemption = {
  redemption_uuid: 'r-1',
  weight_grams: 2,
  status: 'PENDING',
  pickup_code: '482915',
  created_at: '2026-10-01T10:00:00Z',
};

describe('RedemptionCard', () => {
  beforeAll(() => installMatchMedia());
  beforeEach(() => jest.clearAllMocks());

  it('shows a collected redemption without code or cancel action', () => {
    renderWithProviders(
      <RedemptionCard
        redemption={{
          ...pending,
          status: 'COLLECTED',
          collected_at: '2026-10-02T12:00:00Z',
        }}
      />,
    );

    expect(screen.getByText('Collected')).toBeTruthy();
    expect(screen.getByText('Collected on')).toBeTruthy();
    expect(screen.queryByText('482915')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancel redemption' })).toBeNull();
  });

  it('shows a cancelled redemption without code or cancel action', () => {
    renderWithProviders(
      <RedemptionCard
        redemption={{
          ...pending,
          status: 'CANCELLED',
          cancelled_at: '2026-10-02T12:00:00Z',
        }}
      />,
    );

    expect(screen.getByText('Cancelled')).toBeTruthy();
    expect(screen.getByText('Cancelled on')).toBeTruthy();
    expect(screen.queryByText('482915')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancel redemption' })).toBeNull();
  });

  it('asks for confirmation before cancelling and can be dismissed', () => {
    renderWithProviders(<RedemptionCard redemption={pending} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel redemption' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Cancel this redemption?')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Keep it' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mockedService.cancel).not.toHaveBeenCalled();
  });

  it('shows a generic failure for other errors', async () => {
    mockedService.cancel.mockRejectedValue({ code: 'X', message: 'Server down', status: 500 });
    renderWithProviders(<RedemptionCard redemption={pending} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel redemption' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, cancel' }));

    expect(await screen.findByText('Could not cancel redemption')).toBeTruthy();
  });
});

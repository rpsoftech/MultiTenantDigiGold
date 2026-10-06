// Form, quick-amount and confirm-modal interactions of RedeemFlow. The core flow (pickup
// steps, empty vault, Max rounding, over-balance, create + pickup code, server errors) is in
// RedeemFlow.spec.tsx.
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { installMatchMedia, renderWithProviders } from '@/test-utils/renderWithProviders';
import { redemptionService } from '@/features/redemption/redemption.service';
import { RedeemFlow } from './RedeemFlow';

jest.mock('@/features/redemption/redemption.service', () => ({
  redemptionService: { create: jest.fn(), list: jest.fn(), cancel: jest.fn() },
}));

const mockedService = redemptionService as jest.Mocked<typeof redemptionService>;

const GRAMS_LABEL = 'Weight to redeem (grams)';

function type(value: string) {
  fireEvent.change(screen.getByLabelText(GRAMS_LABEL), { target: { value } });
}

function continueButton() {
  return screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement;
}

describe('RedeemFlow', () => {
  beforeAll(() => installMatchMedia());
  beforeEach(() => jest.clearAllMocks());

  it('shows the available balance and keeps Continue disabled until the weight is valid', async () => {
    renderWithProviders(<RedeemFlow balanceGrams={5} />);

    expect(screen.getByText('5.0000 g')).toBeTruthy();
    expect(continueButton().disabled).toBe(true);

    type('2');
    await waitFor(() => expect(continueButton().disabled).toBe(false));
  });

  it('rejects a weight with too many decimals', async () => {
    renderWithProviders(<RedeemFlow balanceGrams={5} />);

    type('1.23456');

    expect(await screen.findByText(/up to 4 decimal places/)).toBeTruthy();
  });

  it('only offers quick amounts that fit in the vault, plus Max', () => {
    renderWithProviders(<RedeemFlow balanceGrams={1.5} />);

    expect(screen.getByRole('button', { name: '0.5 g' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '1 g' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '5 g' })).toBeNull();
    expect(screen.queryByRole('button', { name: '10 g' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Max' })).toBeTruthy();
  });

  it('fills the weight from a chip and from Max (rounded down)', async () => {
    renderWithProviders(<RedeemFlow balanceGrams={2.34567} />);
    const input = screen.getByLabelText(GRAMS_LABEL) as HTMLInputElement;

    fireEvent.click(screen.getByRole('button', { name: '1 g' }));
    expect(input.value).toBe('1');

    fireEvent.click(screen.getByRole('button', { name: 'Max' }));
    expect(input.value).toBe('2.3456');
    await waitFor(() => expect(continueButton().disabled).toBe(false));
  });

  it('opens a confirmation modal summarising the redemption', async () => {
    renderWithProviders(<RedeemFlow balanceGrams={5} />);
    type('2');
    await waitFor(() => expect(continueButton().disabled).toBe(false));

    fireEvent.click(continueButton());

    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('Confirm redemption');
    expect(dialog.textContent).toContain('2.0000 g');
    expect(dialog.textContent).toContain('3.0000 g');
    expect(mockedService.create).not.toHaveBeenCalled();
  });

  it('returns to the form with the typed weight when the modal is dismissed', async () => {
    renderWithProviders(<RedeemFlow balanceGrams={5} />);
    type('2');
    await waitFor(() => expect(continueButton().disabled).toBe(false));
    fireEvent.click(continueButton());
    await screen.findByRole('dialog');

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect((screen.getByLabelText(GRAMS_LABEL) as HTMLInputElement).value).toBe('2');
    expect(mockedService.create).not.toHaveBeenCalled();
  });

  it('starts over from the success screen', async () => {
    mockedService.create.mockResolvedValue({
      success: true,
      message: 'ok',
      redemption: {
        redemption_uuid: 'r-1',
        weight_grams: 2,
        status: 'PENDING',
        pickup_code: '482915',
        created_at: '2026-10-01T10:00:00Z',
      },
    });
    renderWithProviders(<RedeemFlow balanceGrams={5} />);
    type('2');
    await waitFor(() => expect(continueButton().disabled).toBe(false));
    fireEvent.click(continueButton());
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));
    await screen.findByText('Redemption requested');

    fireEvent.click(screen.getByRole('button', { name: 'Redeem more' }));

    expect((screen.getByLabelText(GRAMS_LABEL) as HTMLInputElement).value).toBe('');
  });

  it('keeps the modal open and reports the error when creation fails', async () => {
    mockedService.create.mockRejectedValue({
      code: 'ERROR_INSUFFICIENT_BALANCE',
      message: 'Insufficient gold balance for this transaction.',
      status: 400,
    });
    renderWithProviders(<RedeemFlow balanceGrams={5} />);
    type('2');
    await waitFor(() => expect(continueButton().disabled).toBe(false));
    fireEvent.click(continueButton());

    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));

    expect(await screen.findByText('Could not create redemption')).toBeTruthy();
    expect(screen.getByText('Insufficient gold balance for this transaction.')).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.queryByText('Redemption requested')).toBeNull();
  });

  it('sends the request once even if Confirm is pressed repeatedly', async () => {
    type CreateResult = Awaited<ReturnType<typeof redemptionService.create>>;
    let resolveCreate: (value: CreateResult) => void = () => undefined;
    mockedService.create.mockImplementation(
      () => new Promise<CreateResult>((resolve) => (resolveCreate = resolve)),
    );
    renderWithProviders(<RedeemFlow balanceGrams={5} />);
    type('2');
    await waitFor(() => expect(continueButton().disabled).toBe(false));
    fireEvent.click(continueButton());
    const confirm = await screen.findByRole('button', { name: 'Confirm' });

    fireEvent.click(confirm);
    // While the request is in flight the buttons are replaced by a loader.
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Confirm' })).toBeNull());
    expect(screen.getByRole('status', { name: 'Creating your redemption' })).toBeTruthy();
    expect(mockedService.create).toHaveBeenCalledTimes(1);

    resolveCreate({
      success: true,
      message: 'ok',
      redemption: {
        redemption_uuid: 'r-1',
        weight_grams: 2,
        status: 'PENDING',
        pickup_code: '111111',
        created_at: '2026-10-01T10:00:00Z',
      },
    });
    expect(await screen.findByText('Redemption requested')).toBeTruthy();
  });

});

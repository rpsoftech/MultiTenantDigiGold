import { fireEvent, screen, waitFor } from '@testing-library/react';
import {
  customerUser,
  renderWithProviders,
} from '@/test-utils/renderWithProviders';
import { kycService } from '@/features/kyc/kyc.service';
import { getStoredKycStatus } from '@/features/kyc/kyc-status-storage';
import type { KycStatus } from '@/store/session/session.types';
import { Kyc } from './Kyc';

const replace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: jest.fn() }),
}));
jest.mock('@/features/kyc/kyc.service', () => ({
  kycService: { submitKyc: jest.fn() },
}));

const mockedService = kycService as jest.Mocked<typeof kycService>;

function withStatus(kycStatus: KycStatus) {
  return { user: { ...customerUser, kycStatus } };
}

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function submitButton() {
  return screen.getByRole('button', {
    name: 'Submit for Verification',
  }) as HTMLButtonElement;
}

describe('Kyc page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
  });

  describe('status views', () => {
    it('shows the form for a customer who has not started', () => {
      renderWithProviders(<Kyc />, withStatus('not_started'));

      expect(
        screen.getByRole('heading', { name: 'Complete your KYC' }),
      ).toBeTruthy();
      expect(screen.getByLabelText('PAN Number')).toBeTruthy();
      expect(screen.getByLabelText('Aadhaar (last 4 digits)')).toBeTruthy();
      expect(screen.getByLabelText('Document Link (Optional)')).toBeTruthy();
    });

    it('shows the review message and no form while pending', () => {
      renderWithProviders(<Kyc />, withStatus('pending'));

      expect(
        screen.getByRole('heading', { name: 'KYC under review' }),
      ).toBeTruthy();
      expect(screen.queryByLabelText('PAN Number')).toBeNull();
      expect(
        screen
          .getByRole('link', { name: 'Back to home' })
          .getAttribute('href'),
      ).toBe('/home');
    });

    it('shows the verified message and no form once verified', () => {
      renderWithProviders(<Kyc />, withStatus('verified'));

      expect(screen.getByRole('heading', { name: 'KYC verified' })).toBeTruthy();
      expect(screen.queryByLabelText('PAN Number')).toBeNull();
    });

    it('shows the form with a notice when the last submission was rejected', () => {
      renderWithProviders(<Kyc />, withStatus('rejected'));

      expect(screen.getByLabelText('PAN Number')).toBeTruthy();
      expect(screen.getByText(/was not approved/i)).toBeTruthy();
    });

    it('sends a visitor without a session to login and shows no form', async () => {
      renderWithProviders(<Kyc />, { user: null });

      await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
      expect(screen.queryByLabelText('PAN Number')).toBeNull();
    });
  });

  describe('form', () => {
    it('keeps submit disabled until PAN and Aadhaar are valid', async () => {
      renderWithProviders(<Kyc />, withStatus('not_started'));
      expect(submitButton().disabled).toBe(true);

      fill('PAN Number', 'ABCDE1234F');
      expect(submitButton().disabled).toBe(true);

      fill('Aadhaar (last 4 digits)', '1234');
      await waitFor(() => expect(submitButton().disabled).toBe(false));
    });

    it('shows field errors for invalid values', async () => {
      renderWithProviders(<Kyc />, withStatus('not_started'));

      fill('PAN Number', 'BAD');
      fill('Aadhaar (last 4 digits)', '12');

      expect(await screen.findByText(/valid PAN/i)).toBeTruthy();
      expect(
        await screen.findByText('Enter the last 4 digits of your Aadhaar'),
      ).toBeTruthy();
    });

    it('rejects a non-https document link but allows leaving it empty', async () => {
      renderWithProviders(<Kyc />, withStatus('not_started'));
      fill('PAN Number', 'ABCDE1234F');
      fill('Aadhaar (last 4 digits)', '1234');
      await waitFor(() => expect(submitButton().disabled).toBe(false));

      fill('Document Link (Optional)', 'http://example.com/doc.pdf');
      expect(await screen.findByText(/valid https/i)).toBeTruthy();
      expect(submitButton().disabled).toBe(true);

      fill('Document Link (Optional)', '');
      await waitFor(() => expect(submitButton().disabled).toBe(false));
    });

    it('submits without a document link and moves to the pending view', async () => {
      mockedService.submitKyc.mockResolvedValue({ success: true, message: 'ok' });
      const { store } = renderWithProviders(<Kyc />, withStatus('not_started'));
      fill('PAN Number', 'abcde1234f');
      fill('Aadhaar (last 4 digits)', '1234');
      await waitFor(() => expect(submitButton().disabled).toBe(false));

      fireEvent.click(submitButton());

      expect(
        await screen.findByRole('heading', { name: 'KYC under review' }),
      ).toBeTruthy();
      expect(mockedService.submitKyc.mock.calls[0][0]).toEqual({
        pan_number: 'ABCDE1234F',
        aadhaar_last4: '1234',
      });
      expect(store.getState().session.user?.kycStatus).toBe('pending');
      expect(getStoredKycStatus('user-1')).toBe('pending');
    });

    it('includes the document link when one is given', async () => {
      mockedService.submitKyc.mockResolvedValue({ success: true, message: 'ok' });
      renderWithProviders(<Kyc />, withStatus('not_started'));
      fill('PAN Number', 'ABCDE1234F');
      fill('Aadhaar (last 4 digits)', '1234');
      fill('Document Link (Optional)', 'https://example.com/doc.pdf');
      await waitFor(() => expect(submitButton().disabled).toBe(false));

      fireEvent.click(submitButton());

      await waitFor(() => expect(mockedService.submitKyc).toHaveBeenCalled());
      expect(mockedService.submitKyc.mock.calls[0][0]).toEqual({
        pan_number: 'ABCDE1234F',
        aadhaar_last4: '1234',
        document_url: 'https://example.com/doc.pdf',
      });
    });

    it('shows a loader instead of the form while the request is in flight', async () => {
      mockedService.submitKyc.mockReturnValue(new Promise(() => undefined) as never);
      renderWithProviders(<Kyc />, withStatus('not_started'));
      fill('PAN Number', 'ABCDE1234F');
      fill('Aadhaar (last 4 digits)', '1234');
      await waitFor(() => expect(submitButton().disabled).toBe(false));

      fireEvent.click(submitButton());

      expect(
        await screen.findByRole('status', { name: 'Submitting your KYC' }),
      ).toBeTruthy();
      // The form stays mounted but hidden so typed values survive a failed request.
      expect(
        (screen.getByLabelText('PAN Number') as HTMLInputElement).closest('[hidden]'),
      ).not.toBeNull();
    });

    it('reports a failure, keeps the typed values and stays on the form', async () => {
      mockedService.submitKyc.mockRejectedValue({
        message: 'Server exploded',
        code: 'X',
        status: 500,
      });
      const { store } = renderWithProviders(<Kyc />, withStatus('not_started'));
      fill('PAN Number', 'ABCDE1234F');
      fill('Aadhaar (last 4 digits)', '1234');
      await waitFor(() => expect(submitButton().disabled).toBe(false));

      fireEvent.click(submitButton());

      expect(await screen.findByText('Could not submit KYC')).toBeTruthy();
      expect(screen.getByText('Server exploded')).toBeTruthy();
      expect(
        (screen.getByLabelText('PAN Number') as HTMLInputElement).value,
      ).toBe('ABCDE1234F');
      expect(store.getState().session.user?.kycStatus).toBe('not_started');
    });
  });
});

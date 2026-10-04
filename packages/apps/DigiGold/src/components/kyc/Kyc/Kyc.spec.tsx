import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/common/Toast/Toast';
import { useKycStatus } from '@/features/kyc/hooks/useKycStatus';
import { kycService } from '@/features/kyc/kyc.service';
import { makeStore, type AppStore } from '@/store';
import { registrationStarted, sessionEstablished } from '@/store/session/session.slice';
import type { KycStatus } from '@/store/session/session.types';
import { Kyc } from './Kyc';

jest.mock('next/navigation', () => ({ useRouter: jest.fn() }));
jest.mock('@/components/common/Toast/Toast', () => ({ useToast: jest.fn() }));
jest.mock('@/features/kyc/hooks/useKycStatus', () => ({
  useKycStatus: jest.fn(),
  KYC_STATUS_QUERY_KEY: ['user', 'kyc'],
}));
jest.mock('@/features/kyc/kyc.service', () => ({
  kycService: { submitKyc: jest.fn(), getStatus: jest.fn() },
}));

const replace = jest.fn();
const showToast = jest.fn();
const refetch = jest.fn();
let store: AppStore;

function setKyc(status: KycStatus | undefined, isError = false) {
  jest.mocked(useKycStatus).mockReturnValue({ status, isError, isFetching: false, refetch });
}

function signIn() {
  store.dispatch(
    sessionEstablished({
      userId: 'customer-uuid',
      role: 'customer',
      isNewUser: false,
      kycStatus: 'not_started',
    }),
  );
}

function renderKyc() {
  return render(
    <Provider store={store}>
      <QueryClientProvider client={new QueryClient()}>
        <Kyc />
      </QueryClientProvider>
    </Provider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  store = makeStore();
  setKyc(undefined);
  jest.mocked(useRouter).mockReturnValue({
    push: jest.fn(),
    replace,
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  });
  jest.mocked(useToast).mockReturnValue({ showToast });
});

afterEach(cleanup);

describe('KYC page access', () => {
  it('sends a signed-out visitor to login', () => {
    renderKyc();
    expect(replace).toHaveBeenCalledWith('/login');
  });

  it('treats a half-registered visitor (no access token) as signed out', () => {
    store.dispatch(registrationStarted({ token: 'registration-token', phone: '9999900001' }));
    renderKyc();
    expect(replace).toHaveBeenCalledWith('/login');
  });

  it('shows a loader, not the form, until the real status arrives', () => {
    signIn();
    renderKyc();
    expect(screen.getByRole('status', { name: 'Loading your KYC status' })).toBeTruthy();
    expect(screen.queryByLabelText('PAN Number')).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it('offers a retry when the status cannot be loaded', () => {
    signIn();
    setKyc(undefined, true);
    renderKyc();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalled();
  });
});

describe('KYC status views', () => {
  it('shows the verified state without a form', () => {
    signIn();
    setKyc('verified');
    renderKyc();
    expect(screen.getByText('KYC verified')).toBeTruthy();
    expect(screen.getByText(/Purchases above ₹50,000 are unlocked/)).toBeTruthy();
    expect(screen.queryByLabelText('PAN Number')).toBeNull();
  });

  it('shows the under-review state without a form', () => {
    signIn();
    setKyc('pending');
    renderKyc();
    expect(screen.getByText('KYC under review')).toBeTruthy();
    expect(screen.queryByLabelText('PAN Number')).toBeNull();
  });

  it('shows the form for a customer who has not started, without a document link field', () => {
    signIn();
    setKyc('not_started');
    renderKyc();
    expect(screen.getByLabelText('PAN Number')).toBeTruthy();
    expect(screen.queryByLabelText(/Document Link/)).toBeNull();
    expect(screen.queryByText(/not approved/)).toBeNull();
  });

  it('explains a rejection above the form', () => {
    signIn();
    setKyc('rejected');
    renderKyc();
    expect(screen.getByText(/previous KYC submission was not approved/)).toBeTruthy();
    expect(screen.getByLabelText('PAN Number')).toBeTruthy();
  });
});

describe('KYC submission', () => {
  it('sends only the normalised PAN and Aadhaar last 4', async () => {
    jest.mocked(kycService.submitKyc).mockResolvedValue({ success: true, message: 'ok' });
    signIn();
    setKyc('not_started');
    renderKyc();

    fireEvent.change(screen.getByLabelText('PAN Number'), { target: { value: 'abcde1234f' } });
    fireEvent.change(screen.getByLabelText('Aadhaar (last 4 digits)'), { target: { value: '1234' } });
    const submit = screen.getByRole<HTMLButtonElement>('button', { name: 'Submit for Verification' });
    await waitFor(() => expect(submit.disabled).toBe(false));
    fireEvent.click(submit);

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'success', title: 'KYC submitted for verification' }),
      ),
    );
    expect(jest.mocked(kycService.submitKyc).mock.calls[0][0]).toEqual({
      pan_number: 'ABCDE1234F',
      aadhaar_last4: '1234',
    });
  });

  it("shows the server's reason when a submission is refused", async () => {
    jest.mocked(kycService.submitKyc).mockRejectedValue({
      message: 'Your KYC is already verified or under review',
      code: 'KYC_NOT_SUBMITTABLE',
      status: 409,
    });
    signIn();
    setKyc('not_started');
    renderKyc();

    fireEvent.change(screen.getByLabelText('PAN Number'), { target: { value: 'ABCDE1234F' } });
    fireEvent.change(screen.getByLabelText('Aadhaar (last 4 digits)'), { target: { value: '1234' } });
    const submit = screen.getByRole<HTMLButtonElement>('button', { name: 'Submit for Verification' });
    await waitFor(() => expect(submit.disabled).toBe(false));
    fireEvent.click(submit);

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'danger',
          description: 'Your KYC is already verified or under review',
        }),
      ),
    );
  });
});

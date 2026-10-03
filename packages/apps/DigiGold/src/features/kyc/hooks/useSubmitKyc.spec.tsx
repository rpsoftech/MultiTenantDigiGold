import { act, waitFor } from '@testing-library/react';
import { renderHookWithProviders } from '@/test-utils/renderWithProviders';
import { kycService } from '../kyc.service';
import { getStoredKycStatus } from '../kyc-status-storage';
import { useSubmitKyc } from './useSubmitKyc';

jest.mock('../kyc.service', () => ({
  kycService: { submitKyc: jest.fn() },
}));

const mockedService = kycService as jest.Mocked<typeof kycService>;
const payload = { pan_number: 'ABCDE1234F', aadhaar_last4: '1234' };

describe('useSubmitKyc', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
  });

  it('marks the session and the stored status as pending after a successful submit', async () => {
    mockedService.submitKyc.mockResolvedValue({ success: true, message: 'ok' });
    const { result, store } = renderHookWithProviders(() => useSubmitKyc());

    await act(async () => {
      await result.current.mutateAsync(payload);
    });

    // TanStack Query adds a mutation-context argument, so only the payload is compared.
    expect(mockedService.submitKyc.mock.calls[0][0]).toEqual(payload);
    expect(store.getState().session.user?.kycStatus).toBe('pending');
    expect(getStoredKycStatus('user-1')).toBe('pending');
  });

  it('leaves the status untouched when the request fails', async () => {
    mockedService.submitKyc.mockRejectedValue({ message: 'nope', code: 'X', status: 500 });
    const { result, store } = renderHookWithProviders(() => useSubmitKyc());

    await act(async () => {
      await result.current.mutateAsync(payload).catch(() => undefined);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(store.getState().session.user?.kycStatus).toBe('not_started');
    expect(getStoredKycStatus('user-1')).toBe('not_started');
  });
});

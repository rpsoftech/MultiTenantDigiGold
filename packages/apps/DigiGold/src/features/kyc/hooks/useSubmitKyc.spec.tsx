import { act, waitFor } from '@testing-library/react';
import { renderHookWithProviders } from '@/test-utils/renderWithProviders';
import { kycService } from '../kyc.service';
import type { KycStatusResult } from '../kyc.types';
import { KYC_STATUS_QUERY_KEY } from './useKycStatus';
import { useSubmitKyc } from './useSubmitKyc';

jest.mock('../kyc.service', () => ({
  kycService: { submitKyc: jest.fn() },
}));

const mockedService = kycService as jest.Mocked<typeof kycService>;
const payload = { pan_number: 'ABCDE1234F', aadhaar_last4: '1234' };

// KYC status comes from MainServer (GET /user/kyc, cached under KYC_STATUS_QUERY_KEY), not
// from the session or browser storage, so the mutation only ever touches that query.
describe('useSubmitKyc', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('marks the cached KYC status as pending after a successful submit', async () => {
    mockedService.submitKyc.mockResolvedValue({ success: true, message: 'ok' });
    const { result, queryClient, store } = renderHookWithProviders(() =>
      useSubmitKyc(),
    );

    await act(async () => {
      await result.current.mutateAsync(payload);
    });

    // TanStack Query adds a mutation-context argument, so only the payload is compared.
    expect(mockedService.submitKyc.mock.calls[0][0]).toEqual(payload);
    expect(
      queryClient.getQueryData<KycStatusResult>(KYC_STATUS_QUERY_KEY)
        ?.kyc_status,
    ).toBe('pending');
    expect(store.getState().session.user?.kycStatus).toBe('not_started');
  });

  it('refetches the status when MainServer says it can no longer be submitted', async () => {
    mockedService.submitKyc.mockRejectedValue({
      message: 'KYC is already pending',
      code: 'KYC_NOT_SUBMITTABLE',
      status: 409,
    });
    const { result, queryClient } = renderHookWithProviders(() =>
      useSubmitKyc(),
    );
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      await result.current.mutateAsync(payload).catch(() => undefined);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: KYC_STATUS_QUERY_KEY });
  });

  it('leaves the status untouched when the request fails for another reason', async () => {
    mockedService.submitKyc.mockRejectedValue({
      message: 'nope',
      code: 'X',
      status: 500,
    });
    const { result, queryClient } = renderHookWithProviders(() =>
      useSubmitKyc(),
    );
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      await result.current.mutateAsync(payload).catch(() => undefined);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(queryClient.getQueryData(KYC_STATUS_QUERY_KEY)).toBeUndefined();
    expect(invalidate).not.toHaveBeenCalled();
  });
});

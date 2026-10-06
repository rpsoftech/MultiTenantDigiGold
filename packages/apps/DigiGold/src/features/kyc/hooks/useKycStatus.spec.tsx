import { act, waitFor } from '@testing-library/react';
import {
  customerUser,
  renderHookWithProviders,
} from '@/test-utils/renderWithProviders';
import { kycService } from '../kyc.service';
import { KYC_STATUS_QUERY_KEY, useKycStatus } from './useKycStatus';

jest.mock('../kyc.service', () => ({
  kycService: { getStatus: jest.fn(), submitKyc: jest.fn() },
}));

const mockedService = kycService as jest.Mocked<typeof kycService>;

// The status gates purchases above the KYC limit (BuyGold), so these rules matter:
// only a signed-in customer's status is fetched, and "not loaded yet" is never reported
// as 'not_started' (that would block a verified customer while the request is in flight).
describe('useKycStatus', () => {
  beforeEach(() => jest.clearAllMocks());

  it("reads the signed-in customer's status from MainServer", async () => {
    mockedService.getStatus.mockResolvedValue({
      success: true,
      kyc_status: 'verified',
    });
    const { result, queryClient } = renderHookWithProviders(() =>
      useKycStatus(),
    );

    await waitFor(() => expect(result.current.status).toBe('verified'));
    expect(mockedService.getStatus).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(KYC_STATUS_QUERY_KEY)).toEqual({
      success: true,
      kyc_status: 'verified',
    });
  });

  it('reports no status, not "not_started", while the request is in flight', () => {
    mockedService.getStatus.mockReturnValue(new Promise(() => undefined));
    const { result } = renderHookWithProviders(() => useKycStatus());

    expect(result.current.status).toBeUndefined();
    expect(result.current.isFetching).toBe(true);
  });

  it('does not ask for a status without a signed-in customer', () => {
    const { result } = renderHookWithProviders(() => useKycStatus(), {
      user: null,
    });

    expect(result.current.status).toBeUndefined();
    expect(mockedService.getStatus).not.toHaveBeenCalled();
  });

  it('does not ask for a status for a half-registered visitor', () => {
    // registrationStarted puts a user in the session before any access token exists.
    const { result } = renderHookWithProviders(() => useKycStatus(), {
      preloaded: {
        session: {
          user: { ...customerUser, userId: '', isNewUser: true },
          isAuthenticated: false,
          admin: null,
          revision: 0,
          registrationToken: 'registration-token',
          registrationPhone: customerUser.mobileNumber ?? null,
        },
      },
    });

    expect(result.current.status).toBeUndefined();
    expect(mockedService.getStatus).not.toHaveBeenCalled();
  });

  it('reports a failure and lets the caller retry', async () => {
    mockedService.getStatus
      .mockRejectedValueOnce({
        message: 'down',
        code: 'ERR_BAD_RESPONSE',
        status: 503,
      })
      .mockResolvedValueOnce({ success: true, kyc_status: 'pending' });
    const { result } = renderHookWithProviders(() => useKycStatus());

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.status).toBeUndefined();

    act(() => result.current.refetch());

    await waitFor(() => expect(result.current.status).toBe('pending'));
  });
});

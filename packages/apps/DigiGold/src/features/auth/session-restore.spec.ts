import { makeJwt } from '@/test-utils/renderWithProviders';
import { setStoredKycStatus } from '@/features/kyc/kyc-status-storage';
import { restoreSessionUser } from './session-restore';

const FUTURE = Math.floor(Date.now() / 1000) + 3600;
const PAST = Math.floor(Date.now() / 1000) - 3600;

describe('restoreSessionUser', () => {
  beforeEach(() => window.localStorage.clear());

  it('returns null when there is no stored token', () => {
    expect(restoreSessionUser()).toBeNull();
  });

  it('restores the customer and their remembered kyc status', () => {
    window.localStorage.setItem(
      'access_token',
      makeJwt({ user_uuid: 'user-1', phone: '9999900001', exp: FUTURE }),
    );
    setStoredKycStatus('user-1', 'pending');

    expect(restoreSessionUser()).toEqual({
      userId: 'user-1',
      role: 'customer',
      mobileNumber: '9999900001',
      isNewUser: false,
      kycStatus: 'pending',
    });
  });

  it('falls back to not_started when no kyc status was remembered', () => {
    window.localStorage.setItem(
      'access_token',
      makeJwt({ user_uuid: 'user-2', phone: '9999900002', exp: FUTURE }),
    );

    expect(restoreSessionUser()?.kycStatus).toBe('not_started');
  });

  it('clears an expired token and returns null', () => {
    window.localStorage.setItem(
      'access_token',
      makeJwt({ user_uuid: 'user-1', phone: '9999900001', exp: PAST }),
    );

    expect(restoreSessionUser()).toBeNull();
    expect(window.localStorage.getItem('access_token')).toBeNull();
  });

  it('clears a malformed token and returns null', () => {
    window.localStorage.setItem('access_token', 'not-a-jwt');

    expect(restoreSessionUser()).toBeNull();
    expect(window.localStorage.getItem('access_token')).toBeNull();
  });
});

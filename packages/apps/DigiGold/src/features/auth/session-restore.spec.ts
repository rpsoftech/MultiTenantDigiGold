import { makeJwt } from '@/test-utils/renderWithProviders';
import { restoreSessionUser } from './session-restore';

const FUTURE = Math.floor(Date.now() / 1000) + 3600;
const PAST = Math.floor(Date.now() / 1000) - 3600;

describe('restoreSessionUser', () => {
  beforeEach(() => window.localStorage.clear());

  it('returns null when there is no stored token', () => {
    expect(restoreSessionUser()).toBeNull();
  });

  // KYC status is not in the token and is never trusted from browser storage: screens
  // that need it fetch it from MainServer (GET /user/kyc) once mounted.
  it('restores the customer from the token, with KYC status left to the server', () => {
    window.localStorage.setItem(
      'access_token',
      makeJwt({ user_uuid: 'user-1', phone: '9999900001', exp: FUTURE }),
    );

    expect(restoreSessionUser()).toEqual({
      userId: 'user-1',
      role: 'customer',
      mobileNumber: '9999900001',
      isNewUser: false,
      kycStatus: 'not_started',
    });
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

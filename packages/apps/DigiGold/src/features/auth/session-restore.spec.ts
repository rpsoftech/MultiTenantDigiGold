import { makeJwt } from '@/test-utils/renderWithProviders';
import { getRegistrationToken } from '@/lib/auth/tokenStorage';
import { restoreRegistration, restoreSessionUser } from './session-restore';

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

  it('keeps a session whose access token expired while the refresh token is still valid', () => {
    window.localStorage.setItem(
      'access_token',
      makeJwt({ user_uuid: 'user-1', phone: '9999900001', exp: PAST }),
    );
    window.localStorage.setItem(
      'refresh_token',
      makeJwt({ user_uuid: 'user-1', exp: FUTURE }),
    );

    // apiClient renews the access token on the first request.
    expect(restoreSessionUser()?.userId).toBe('user-1');
    expect(window.localStorage.getItem('access_token')).not.toBeNull();
  });

  it('clears a session whose refresh token expired too', () => {
    window.localStorage.setItem(
      'access_token',
      makeJwt({ user_uuid: 'user-1', phone: '9999900001', exp: PAST }),
    );
    window.localStorage.setItem(
      'refresh_token',
      makeJwt({ user_uuid: 'user-1', exp: PAST }),
    );

    expect(restoreSessionUser()).toBeNull();
    expect(window.localStorage.getItem('refresh_token')).toBeNull();
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

// A sign-up in progress (OTP verified, profile not completed) survives a page refresh.
describe('restoreRegistration', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('returns nothing when no sign-up is in progress', () => {
    expect(restoreRegistration()).toBeNull();
  });

  it('restores the registration token and the phone it was issued for', () => {
    const token = makeJwt({ phone: '9876543210', exp: FUTURE });
    window.sessionStorage.setItem('registration_token', token);

    expect(restoreRegistration()).toEqual({ token, phone: '9876543210' });
  });

  it('forgets an expired or unreadable registration token', () => {
    window.sessionStorage.setItem(
      'registration_token',
      makeJwt({ phone: '9876543210', exp: PAST }),
    );
    expect(restoreRegistration()).toBeNull();
    expect(getRegistrationToken()).toBeNull();

    window.sessionStorage.setItem('registration_token', 'not-a-jwt');
    expect(restoreRegistration()).toBeNull();
    expect(getRegistrationToken()).toBeNull();
  });
});

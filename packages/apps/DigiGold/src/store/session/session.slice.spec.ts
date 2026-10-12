import { describe, expect, it } from '@jest/globals';
import { makeStore } from '@/store';
import {
  adminSessionCleared,
  adminSessionEstablished,
  profileCompleted,
  registrationStarted,
  selectIsAdmin,
  selectIsAuthenticated,
  selectSessionUser,
  sessionCleared,
  sessionEstablished,
} from './session.slice';
import type { SessionUser } from './session.types';

const customer: SessionUser = {
  userId: 'u-1',
  role: 'customer',
  mobileNumber: '9876543210',
  isNewUser: false,
  kycStatus: 'verified',
};
const admin: SessionUser = {
  userId: 'admin-1',
  role: 'admin',
  isNewUser: false,
  kycStatus: 'not_started',
};

describe('session slice auth flow', () => {
  it('starts logged out', () => {
    const store = makeStore();

    expect(selectSessionUser(store.getState())).toBeNull();
    expect(selectIsAuthenticated(store.getState())).toBe(false);
    expect(selectIsAdmin(store.getState())).toBe(false);
  });

  it('establishes a session and drops any registration state', () => {
    const store = makeStore();
    store.dispatch(registrationStarted({ token: 'reg', phone: '9876543210' }));

    store.dispatch(sessionEstablished(customer));

    const state = store.getState().session;
    expect(state.user).toEqual(customer);
    expect(state.isAuthenticated).toBe(true);
    expect(state.registrationToken).toBeNull();
    expect(state.registrationPhone).toBeNull();
  });

  it('starts registration for a new number without authenticating', () => {
    const store = makeStore();

    store.dispatch(
      registrationStarted({ token: 'reg-token', phone: '9876543210' }),
    );

    const state = store.getState().session;
    expect(state.registrationToken).toBe('reg-token');
    expect(state.registrationPhone).toBe('9876543210');
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toEqual({
      userId: '',
      role: 'customer',
      mobileNumber: '9876543210',
      isNewUser: true,
      kycStatus: 'not_started',
    });
  });

  it('completes the profile: no longer new, authenticated, registration cleared', () => {
    const store = makeStore();
    store.dispatch(registrationStarted({ token: 'reg', phone: '9876543210' }));

    store.dispatch(profileCompleted());

    const state = store.getState().session;
    expect(state.user?.isNewUser).toBe(false);
    expect(state.isAuthenticated).toBe(true);
    expect(state.registrationToken).toBeNull();
    expect(state.registrationPhone).toBeNull();
  });

  it('completing a profile without a user still authenticates safely', () => {
    const store = makeStore();

    expect(() => store.dispatch(profileCompleted())).not.toThrow();
    expect(store.getState().session.user).toBeNull();
  });

  it('clears the customer session on logout and moves to a new revision', () => {
    const store = makeStore();
    store.dispatch(sessionEstablished(customer));
    const revision = store.getState().session.revision;

    store.dispatch(sessionCleared());

    expect(store.getState().session).toEqual({
      user: null,
      isAuthenticated: false,
      admin: null,
      revision: revision + 1,
      registrationToken: null,
      registrationPhone: null,
    });
  });

  // The admin panel session lives in its own field, independent of the customer one.
  it('identifies an admin session from the admin slot only', () => {
    const store = makeStore();

    store.dispatch(sessionEstablished({ ...customer, role: 'admin' }));
    expect(selectIsAdmin(store.getState())).toBe(false);

    store.dispatch(adminSessionEstablished({ ...customer, role: 'admin' }));
    expect(selectIsAdmin(store.getState())).toBe(true);
  });
});

describe('session slice: customer and admin sessions are independent', () => {
  it('an admin sign-in does not make the visitor a signed-in customer', () => {
    const store = makeStore();
    store.dispatch(adminSessionEstablished(admin));

    expect(selectIsAdmin(store.getState())).toBe(true);
    expect(selectIsAuthenticated(store.getState())).toBe(false);
    expect(store.getState().session.user).toBeNull();
  });

  it('ending one session leaves the other intact', () => {
    const store = makeStore();
    store.dispatch(sessionEstablished(customer));
    store.dispatch(adminSessionEstablished(admin));

    store.dispatch(sessionCleared());
    expect(store.getState().session.admin).toEqual(admin);

    store.dispatch(sessionEstablished(customer));
    store.dispatch(adminSessionCleared());
    expect(store.getState().session.user).toEqual(customer);
    expect(selectIsAuthenticated(store.getState())).toBe(true);
  });
});

import { makeStore } from '@/store';
import {
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

    store.dispatch(registrationStarted({ token: 'reg-token', phone: '9876543210' }));

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

  it('clears everything on logout', () => {
    const store = makeStore();
    store.dispatch(sessionEstablished(customer));

    store.dispatch(sessionCleared());

    expect(store.getState().session).toEqual({
      user: null,
      isAuthenticated: false,
      registrationToken: null,
      registrationPhone: null,
    });
  });

  it('identifies an admin session', () => {
    const store = makeStore();

    store.dispatch(sessionEstablished({ ...customer, role: 'admin' }));

    expect(selectIsAdmin(store.getState())).toBe(true);
  });
});

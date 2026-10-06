import { describe, expect, it } from '@jest/globals';
import { makeStore } from '@/store';
import {
  adminSessionCleared,
  adminSessionEstablished,
  selectIsAdmin,
  selectIsAuthenticated,
  sessionCleared,
  sessionEstablished,
} from './session.slice';

const customer = {
  userId: 'customer-1',
  role: 'customer' as const,
  isNewUser: false,
  kycStatus: 'verified' as const,
};
const admin = {
  userId: 'admin-1',
  role: 'admin' as const,
  isNewUser: false,
  kycStatus: 'not_started' as const,
};

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

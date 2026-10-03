import { makeStore } from '@/store';
import {
  kycStatusUpdated,
  sessionCleared,
  sessionEstablished,
} from './session.slice';
import type { SessionUser } from './session.types';

const user: SessionUser = {
  userId: 'user-1',
  role: 'customer',
  mobileNumber: '9999900001',
  isNewUser: false,
  kycStatus: 'not_started',
};

describe('session slice kyc status', () => {
  it('updates the kyc status of the signed-in user', () => {
    const store = makeStore();
    store.dispatch(sessionEstablished(user));

    store.dispatch(kycStatusUpdated('pending'));

    expect(store.getState().session.user?.kycStatus).toBe('pending');
    expect(store.getState().session.user?.userId).toBe('user-1');
  });

  it('is a no-op when nobody is signed in', () => {
    const store = makeStore();

    store.dispatch(kycStatusUpdated('verified'));

    expect(store.getState().session.user).toBeNull();
  });

  it('is cleared together with the session', () => {
    const store = makeStore();
    store.dispatch(sessionEstablished(user));
    store.dispatch(kycStatusUpdated('pending'));

    store.dispatch(sessionCleared());

    expect(store.getState().session.user).toBeNull();
    expect(store.getState().session.isAuthenticated).toBe(false);
  });
});

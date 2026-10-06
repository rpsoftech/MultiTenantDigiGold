import { act } from '@testing-library/react';
import { renderHookWithProviders } from '@/test-utils/renderWithProviders';
import {
  getAccessToken,
  getRefreshToken,
  getRegistrationToken,
  setRegistrationToken,
  setTokens,
} from '@/lib/auth/tokenStorage';
import { useLogout } from './useLogout';

const push = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: jest.fn() }),
}));

describe('useLogout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('forgets the tokens, the session and every cached query, then goes to login', () => {
    setTokens({ accessToken: 'access', refreshToken: 'refresh' });
    setRegistrationToken('registration');
    const { result, store, queryClient } = renderHookWithProviders(() =>
      useLogout(),
    );
    queryClient.setQueryData(['portfolio'], { balanceGrams: 1 });
    queryClient.setQueryData(['trade', 'history'], { data: [] });
    const revision = store.getState().session.revision;

    act(() => result.current());

    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(getRegistrationToken()).toBeNull();
    expect(store.getState().session.user).toBeNull();
    expect(store.getState().session.isAuthenticated).toBe(false);
    expect(store.getState().session.revision).toBe(revision + 1);
    // The next account to sign in on this browser must not see this one's data.
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(push).toHaveBeenCalledWith('/login');
  });

  it('leaves an admin panel session in the same browser alone', () => {
    window.localStorage.setItem('admin_access_token', 'admin-access');
    const { result } = renderHookWithProviders(() => useLogout());

    act(() => result.current());

    expect(window.localStorage.getItem('admin_access_token')).toBe(
      'admin-access',
    );
  });
});

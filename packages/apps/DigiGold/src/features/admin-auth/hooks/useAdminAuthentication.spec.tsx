import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import { apiClient } from '@/lib/api/client';
import { clearAdminTokens } from '@/lib/api/admin-tokens';
import { makeStore } from '@/store';
import { useAdminLogin } from './useAdminLogin';
import { useAdminTotpVerify } from './useAdminTotpVerify';

function renderAuthentication() {
  const store = makeStore();
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const hook = renderHook(
    () => ({ login: useAdminLogin(), verify: useAdminTotpVerify() }),
    {
      wrapper: ({ children }) => (
        <Provider store={store}>
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        </Provider>
      ),
    },
  );
  return { ...hook, store, queryClient };
}

describe('admin authentication session', () => {
  const originalMockFlag = process.env.NEXT_PUBLIC_USE_MOCK_ADMIN_AUTH;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_USE_MOCK_ADMIN_AUTH = 'false';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    clearAdminTokens();
    if (originalMockFlag === undefined)
      delete process.env.NEXT_PUBLIC_USE_MOCK_ADMIN_AUTH;
    else process.env.NEXT_PUBLIC_USE_MOCK_ADMIN_AUTH = originalMockFlag;
  });

  it('establishes a session only after the authenticator code is accepted', async () => {
    const token = `header.${btoa(
      JSON.stringify({
        admin_uuid: 'manager-uuid',
        role: 'manager',
        aud: ['digigold:admin:access'],
        exp: Math.floor(Date.now() / 1000) + 900,
      }),
    )
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')}.signature`;
    jest
      .spyOn(apiClient, 'post')
      .mockResolvedValueOnce({ data: { temp_token: 'temporary-token' } })
      .mockResolvedValueOnce({
        data: { access_token: token, refresh_token: 'refresh' },
      });
    const { result, store, queryClient, unmount } = renderAuthentication();

    await act(async () => {
      await result.current.login.mutateAsync({
        username: 'demo-manager',
        password: 'password',
      });
    });
    expect(store.getState().session.isAuthenticated).toBe(false);
    expect(window.localStorage.getItem('admin_access_token')).toBeNull();

    await act(async () => {
      await result.current.verify.mutateAsync({
        temp_token: 'temporary-token',
        code: '012345',
      });
    });
    // The admin session is separate from the customer one, which stays signed out.
    expect(store.getState().session).toMatchObject({
      isAuthenticated: false,
      user: null,
      admin: { userId: 'manager-uuid', role: 'admin' },
    });
    expect(window.localStorage.getItem('admin_access_token')).toBe(token);
    unmount();
    queryClient.clear();
  });

  it('does not establish a session after an invalid TOTP code', async () => {
    jest.spyOn(apiClient, 'post').mockRejectedValue({
      message: 'invalid TOTP code',
      status: 401,
      code: 'ERR_BAD_REQUEST',
    });
    const { result, store, queryClient, unmount } = renderAuthentication();

    await act(async () => {
      await expect(
        result.current.verify.mutateAsync({
          temp_token: 'temporary-token',
          code: '000000',
        }),
      ).rejects.toMatchObject({ message: 'invalid TOTP code' });
    });
    expect(store.getState().session.isAuthenticated).toBe(false);
    expect(window.localStorage.getItem('admin_access_token')).toBeNull();
    unmount();
    queryClient.clear();
  });
});

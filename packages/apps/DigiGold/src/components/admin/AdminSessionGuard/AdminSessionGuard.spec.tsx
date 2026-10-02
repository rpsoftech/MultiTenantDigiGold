import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { adminAuthService } from '@/features/admin-auth/admin-auth.service';
import { useAdminLogout } from '@/features/admin-auth/hooks/useAdminLogout';
import {
  clearAdminTokens,
  getAdminAccessToken,
  getAdminRefreshToken,
  storeAdminTokens,
  type AdminTokens,
} from '@/lib/api/admin-tokens';
import { ROUTES } from '@/lib/constants/routes';
import { makeStore } from '@/store';
import { sessionEstablished } from '@/store/session/session.slice';
import { AdminSessionGuard } from './AdminSessionGuard';

const mockReplace = jest.fn();
const mockRouter = { replace: mockReplace };
jest.mock('next/navigation', () => ({ useRouter: () => mockRouter }));
jest.mock('@/features/admin-auth/admin-auth.service', () => ({
  adminAuthService: { refresh: jest.fn() },
}));

const mockRefresh = jest.mocked(adminAuthService.refresh);

function accessToken(exp = 4102444800) {
  const header = btoa('{"alg":"HS256","typ":"JWT"}');
  const payload = btoa(
    JSON.stringify({
      admin_uuid: 'admin-123',
      role: 'manager',
      aud: ['digigold:admin:access'],
      exp,
    }),
  )
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${header}.${payload}.signature`;
}

const tokens = { access_token: accessToken(), refresh_token: 'refresh-token' };

function LogoutButton() {
  const logout = useAdminLogout();
  return <button onClick={logout}>Sign out</button>;
}

function renderGuard(store = makeStore()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const mounted = jest.fn();
  function Panel() {
    mounted();
    return <p>Protected admin panel</p>;
  }

  queryClient.setQueryData(['admin', 'profile'], { name: 'Old admin' });
  queryClient.setQueryData(['customer', 'wallet'], { balance: 10 });
  render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <AdminSessionGuard>
          <Panel />
        </AdminSessionGuard>
        <LogoutButton />
      </QueryClientProvider>
    </Provider>,
  );
  return { store, queryClient, mounted };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRefresh.mockReset();
  window.localStorage.clear();
  clearAdminTokens();
});

it('restores an admin session from persisted access credentials before mounting the panel', () => {
  storeAdminTokens(tokens);
  const { store } = renderGuard();

  expect(screen.getByText('Protected admin panel')).toBeTruthy();
  expect(store.getState().session.user).toMatchObject({
    userId: 'admin-123',
    role: 'admin',
  });
  expect(mockRefresh).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
});

it('redirects without mounting protected content and preserves an existing customer session', () => {
  const store = makeStore();
  const customer = {
    userId: 'customer-123',
    role: 'customer' as const,
    isNewUser: false,
    kycStatus: 'verified' as const,
  };
  store.dispatch(sessionEstablished(customer));
  window.localStorage.setItem('access_token', 'customer-access');
  const { mounted } = renderGuard(store);

  expect(mounted).not.toHaveBeenCalled();
  expect(mockReplace).toHaveBeenCalledWith(ROUTES.adminLogin);
  expect(store.getState().session.user).toEqual(customer);
  expect(window.localStorage.getItem('access_token')).toBe('customer-access');
});

it('waits for a successful refresh when the persisted access token is expired', async () => {
  storeAdminTokens({ ...tokens, access_token: accessToken(1) });
  let resolveRefresh!: (value: AdminTokens) => void;
  mockRefresh.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveRefresh = resolve;
      }),
  );
  const { mounted, store } = renderGuard();
  expect(mounted).not.toHaveBeenCalled();
  expect(screen.getByRole('status').textContent).toContain('Checking');

  await act(async () => {
    storeAdminTokens(tokens);
    resolveRefresh(tokens);
  });

  expect(screen.getByText('Protected admin panel')).toBeTruthy();
  expect(store.getState().session.user?.role).toBe('admin');
});

it('clears expired admin credentials and cache after refresh rejection', async () => {
  storeAdminTokens({ ...tokens, access_token: accessToken(1) });
  mockRefresh.mockRejectedValue({ status: 401 });
  const { store, queryClient, mounted } = renderGuard();

  await waitFor(() =>
    expect(mockReplace).toHaveBeenCalledWith(ROUTES.adminLogin),
  );
  expect(mounted).not.toHaveBeenCalled();
  expect(getAdminAccessToken()).toBeNull();
  expect(getAdminRefreshToken()).toBeNull();
  expect(store.getState().session.user).toBeNull();
  expect(queryClient.getQueryData(['admin', 'profile'])).toBeUndefined();
  expect(queryClient.getQueryData(['customer', 'wallet'])).toEqual({
    balance: 10,
  });
});

it('preserves credentials and offers retry after a temporary refresh failure', async () => {
  storeAdminTokens({ ...tokens, access_token: accessToken(1) });
  mockRefresh.mockRejectedValueOnce({ status: 503 });
  renderGuard();
  await screen.findByRole('alert');
  expect(getAdminRefreshToken()).toBe('refresh-token');
  expect(mockReplace).not.toHaveBeenCalled();

  mockRefresh.mockImplementationOnce(async () => {
    storeAdminTokens(tokens);
    return tokens;
  });
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await screen.findByText('Protected admin panel');
});

it('removes protected content and admin cache when a request expires the session', () => {
  storeAdminTokens(tokens);
  const { store, queryClient } = renderGuard();
  act(() => window.dispatchEvent(new Event('admin-session-expired')));

  expect(screen.queryByText('Protected admin panel')).toBeNull();
  expect(store.getState().session.user).toBeNull();
  expect(getAdminAccessToken()).toBeNull();
  expect(queryClient.getQueryData(['admin', 'profile'])).toBeUndefined();
  expect(mockReplace).toHaveBeenCalledWith(ROUTES.adminLogin);
});

it('clears admin credentials and cache on logout without clearing customer credentials', () => {
  storeAdminTokens(tokens);
  window.localStorage.setItem('access_token', 'customer-access');
  window.localStorage.setItem('refresh_token', 'customer-refresh');
  const { store, queryClient } = renderGuard();
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

  expect(screen.queryByText('Protected admin panel')).toBeNull();
  expect(store.getState().session.user).toBeNull();
  expect(getAdminAccessToken()).toBeNull();
  expect(getAdminRefreshToken()).toBeNull();
  expect(window.localStorage.getItem('access_token')).toBe('customer-access');
  expect(window.localStorage.getItem('refresh_token')).toBe('customer-refresh');
  expect(queryClient.getQueryData(['admin', 'profile'])).toBeUndefined();
  expect(queryClient.getQueryData(['customer', 'wallet'])).toEqual({
    balance: 10,
  });
  expect(mockReplace).toHaveBeenCalledWith(ROUTES.adminLogin);
});

it('does not restore a session from a late refresh after logout', async () => {
  storeAdminTokens({ ...tokens, access_token: accessToken(1) });
  let resolveRefresh!: (value: AdminTokens) => void;
  mockRefresh.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveRefresh = resolve;
      }),
  );
  const { store, mounted } = renderGuard();
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  await act(async () => resolveRefresh(tokens));

  expect(mounted).not.toHaveBeenCalled();
  expect(store.getState().session.user).toBeNull();
  expect(getAdminAccessToken()).toBeNull();
});

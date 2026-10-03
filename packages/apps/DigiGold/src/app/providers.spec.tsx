import { act, render, screen, waitFor } from '@testing-library/react';
import { makeJwt } from '@/test-utils/renderWithProviders';
import { DEFAULT_TENANT_CONFIG } from '@/features/tenant/tenant.defaults';
import { resolveTenantConfig } from '@/features/tenant/tenant.service';
import { applyTenantTheme } from '@/features/tenant/applyTenantTheme';
import { useSession } from '@/features/auth/hooks/useSession';
import { useTenantConfig } from '@/features/tenant/hooks/useTenantConfig';
import { emitSessionExpired } from '@/lib/auth/sessionEvents';
import { Providers } from './providers';

const push = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: jest.fn() }),
}));
jest.mock('@/features/tenant/tenant.service', () => ({
  resolveTenantConfig: jest.fn(),
}));
jest.mock('@/features/tenant/applyTenantTheme', () => ({
  applyTenantTheme: jest.fn(),
}));

const mockedResolve = resolveTenantConfig as jest.MockedFunction<typeof resolveTenantConfig>;
const mockedApplyTheme = applyTenantTheme as jest.MockedFunction<typeof applyTenantTheme>;

const FUTURE = Math.floor(Date.now() / 1000) + 3600;

function Probe() {
  const { user, isAuthenticated } = useSession();
  const tenant = useTenantConfig();
  return (
    <div>
      <span data-testid="tenant">{tenant?.displayName}</span>
      <span data-testid="user">{user?.userId ?? 'none'}</span>
      <span data-testid="auth">{String(isAuthenticated)}</span>
    </div>
  );
}

function renderProviders() {
  return render(
    <Providers initialTenantConfig={DEFAULT_TENANT_CONFIG}>
      <Probe />
    </Providers>,
  );
}

describe('Providers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    mockedResolve.mockResolvedValue({ ...DEFAULT_TENANT_CONFIG, displayName: 'Acme Jewellers' });
  });

  it('renders its children with the build-time tenant first', () => {
    mockedResolve.mockReturnValue(new Promise(() => undefined));
    renderProviders();

    expect(screen.getByTestId('tenant').textContent).toBe('DigiGold');
  });

  it('applies the default theme immediately', () => {
    mockedResolve.mockReturnValue(new Promise(() => undefined));
    renderProviders();

    expect(mockedApplyTheme).toHaveBeenCalledWith(DEFAULT_TENANT_CONFIG);
  });

  it('swaps in the tenant resolved from the server and re-applies the theme', async () => {
    renderProviders();

    await waitFor(() => expect(screen.getByTestId('tenant').textContent).toBe('Acme Jewellers'));
    expect(mockedApplyTheme).toHaveBeenLastCalledWith(
      expect.objectContaining({ displayName: 'Acme Jewellers' }),
    );
  });

  it('keeps the default tenant when the server cannot be reached', async () => {
    mockedResolve.mockRejectedValue(new Error('offline'));
    renderProviders();

    await waitFor(() => expect(mockedResolve).toHaveBeenCalled());
    expect(screen.getByTestId('tenant').textContent).toBe('DigiGold');
  });

  it('starts logged out when there is no stored token', () => {
    renderProviders();

    expect(screen.getByTestId('user').textContent).toBe('none');
    expect(screen.getByTestId('auth').textContent).toBe('false');
  });

  it('restores the customer from a stored token after a refresh', async () => {
    window.localStorage.setItem(
      'access_token',
      makeJwt({ user_uuid: 'u-7', phone: '9876543210', exp: FUTURE }),
    );
    renderProviders();

    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('u-7'));
    expect(screen.getByTestId('auth').textContent).toBe('true');
  });

  it('ignores an expired stored token', () => {
    window.localStorage.setItem(
      'access_token',
      makeJwt({ user_uuid: 'u-7', phone: '9876543210', exp: Math.floor(Date.now() / 1000) - 60 }),
    );
    renderProviders();

    expect(screen.getByTestId('user').textContent).toBe('none');
  });

  it('logs out and returns to login when the session expires', async () => {
    window.localStorage.setItem(
      'access_token',
      makeJwt({ user_uuid: 'u-7', phone: '9876543210', exp: FUTURE }),
    );
    renderProviders();
    await waitFor(() => expect(screen.getByTestId('auth').textContent).toBe('true'));

    act(() => emitSessionExpired());

    expect(screen.getByTestId('auth').textContent).toBe('false');
    expect(screen.getByTestId('user').textContent).toBe('none');
    expect(push).toHaveBeenCalledWith('/login');
  });

  it('stops listening for session expiry once unmounted', () => {
    const { unmount } = renderProviders();

    unmount();
    act(() => emitSessionExpired());

    expect(push).not.toHaveBeenCalled();
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import { makeJwt } from '@/test-utils/renderWithProviders';
import { DEFAULT_TENANT_CONFIG } from '@/features/tenant/tenant.defaults';
import { resolveTenantConfig } from '@/features/tenant/tenant.service';
import { Providers } from './providers';
import ProfileSetupPage from './(auth)/profile-setup/page';

const replace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace }),
}));
jest.mock('@/features/tenant/tenant.service', () => ({
  resolveTenantConfig: jest.fn(),
}));
jest.mock('@/features/tenant/applyTenantTheme', () => ({
  applyTenantTheme: jest.fn(),
}));
jest.mock('@/components/auth/ProfileSetupForm/ProfileSetupForm', () => ({
  ProfileSetupForm: () => <div>profile form</div>,
}));

const FUTURE = Math.floor(Date.now() / 1000) + 3600;

// A page refresh halfway through sign-up: the store starts empty and SessionLifecycle restores
// the registration in its mount effect, which runs after the page's own effect.
describe('profile setup after a page refresh', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
    (resolveTenantConfig as jest.Mock).mockReturnValue(
      new Promise(() => undefined),
    );
  });

  it('keeps a customer who is still registering on the form', async () => {
    window.sessionStorage.setItem(
      'registration_token',
      makeJwt({ phone: '9876543210', exp: FUTURE }),
    );

    render(
      <Providers initialTenantConfig={DEFAULT_TENANT_CONFIG}>
        <ProfileSetupPage />
      </Providers>,
    );

    expect(await screen.findByText('profile form')).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it('still sends a visitor with no registration to login', async () => {
    render(
      <Providers initialTenantConfig={DEFAULT_TENANT_CONFIG}>
        <ProfileSetupPage />
      </Providers>,
    );

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    expect(screen.queryByText('profile form')).toBeNull();
  });
});

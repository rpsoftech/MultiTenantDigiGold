import { fireEvent, screen, within } from '@testing-library/react';
import {
  customerUser,
  renderWithProviders,
} from '@/test-utils/renderWithProviders';
import { DEFAULT_TENANT_CONFIG } from '@/features/tenant/tenant.defaults';
import { Header } from './Header';

let pathname = '/home';
const back = jest.fn();
jest.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ back, push: jest.fn(), replace: jest.fn() }),
}));
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
  ),
}));

const tenant = { preloaded: { tenant: { config: DEFAULT_TENANT_CONFIG } } };

describe('Header', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pathname = '/home';
  });

  it('shows the brand linking to the home page', () => {
    renderWithProviders(<Header />, { user: null, ...tenant });

    const brandLink = screen
      .getAllByRole('link')
      .find((link) => link.getAttribute('href') === '/home');
    expect(brandLink).toBeDefined();
  });

  it('lists the primary navigation from the site config', () => {
    renderWithProviders(<Header />, { user: null, ...tenant });

    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(nav.textContent).toContain('Home');
    expect(nav.textContent).toContain('Marketplace');
    expect(nav.textContent).toContain('Vault');
  });

  describe('signed out', () => {
    it('offers Sign In and no account menu', () => {
      renderWithProviders(<Header />, { user: null, ...tenant });

      expect(
        screen.getByRole('link', { name: 'Sign In' }).getAttribute('href'),
      ).toBe('/login');
      expect(screen.queryByRole('button', { name: 'Account menu' })).toBeNull();
    });
  });

  describe('signed in', () => {
    it('hides Sign In and shows the account menu', () => {
      renderWithProviders(<Header />, { user: customerUser, ...tenant });

      expect(screen.queryByRole('link', { name: 'Sign In' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Account menu' })).toBeTruthy();
    });
  });

  describe('back button', () => {
    it.each(['/otp', '/profile-setup'])(
      'is shown mid-flow on %s and goes back',
      (route) => {
        pathname = route;
        renderWithProviders(<Header />, { user: null, ...tenant });

        fireEvent.click(screen.getByRole('button', { name: 'Go back' }));

        expect(back).toHaveBeenCalledTimes(1);
      },
    );

    it.each(['/home', '/login', '/vault/passbook'])(
      'is not shown on %s',
      (route) => {
        pathname = route;
        renderWithProviders(<Header />, { user: null, ...tenant });

        expect(screen.queryByRole('button', { name: 'Go back' })).toBeNull();
      },
    );
  });

  describe('mobile menu', () => {
    it('opens from the hamburger button', () => {
      renderWithProviders(<Header />, { user: null, ...tenant });
      expect(screen.queryByRole('dialog')).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));

      expect(screen.getByRole('dialog')).toBeTruthy();
    });

    it('closes again from its close button', () => {
      renderWithProviders(<Header />, { user: null, ...tenant });
      fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));

      fireEvent.click(screen.getByRole('button', { name: 'Close menu' }));

      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('includes the account menu for a signed in customer', () => {
      renderWithProviders(<Header />, { user: customerUser, ...tenant });
      fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));

      // Inside the drawer (a modal dialog) the account entries are listed inline: a popover
      // would open behind the dialog.
      const drawer = within(screen.getByRole('dialog'));
      expect(
        drawer.getByRole('link', { name: 'KYC Verification' }),
      ).toBeTruthy();
      expect(drawer.getByRole('button', { name: 'Logout' })).toBeTruthy();
      expect(drawer.queryByRole('button', { name: 'Account menu' })).toBeNull();
    });
  });
});

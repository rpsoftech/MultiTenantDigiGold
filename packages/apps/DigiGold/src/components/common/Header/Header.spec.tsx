import { act, fireEvent, screen, within } from '@testing-library/react';
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
    expect(nav.textContent).toContain('Vault');
    // Switched off in header.config.json until their pages exist.
    for (const hidden of ['Marketplace', 'Invest', 'About']) {
      expect(nav.textContent).not.toContain(hidden);
    }
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

    it('closes when the screen grows past the mobile breakpoint', () => {
      // A phone turned to landscape: the drawer is replaced by the inline nav, so its
      // overlay and scroll lock must not outlive it.
      let notify: (event: { matches: boolean }) => void = () => undefined;
      const original = window.matchMedia;
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: (query: string) => ({
          matches: false,
          media: query,
          addEventListener: (_: string, listener: typeof notify) => {
            notify = listener;
          },
          removeEventListener: () => undefined,
        }),
      });
      try {
        renderWithProviders(<Header />, { user: null, ...tenant });
        fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
        expect(screen.getByRole('dialog')).toBeTruthy();

        act(() => notify({ matches: true }));

        expect(screen.queryByRole('dialog')).toBeNull();
      } finally {
        Object.defineProperty(window, 'matchMedia', {
          writable: true,
          configurable: true,
          value: original,
        });
      }
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

  describe('published Header block', () => {
    const branded = (props: Record<string, unknown>) => ({
      preloaded: {
        tenant: {
          config: {
            ...DEFAULT_TENANT_CONFIG,
            layout: [{ id: 'h', type: 'Header', variant: '1', props, children: [] }],
          },
        },
      },
    });

    it('brands the single header with the published name', () => {
      renderWithProviders(<Header />, { user: null, ...branded({ brandName: 'Acme Gold' }) });

      expect(screen.getAllByRole('banner')).toHaveLength(1);
      expect(screen.getAllByText('Acme Gold').length).toBeGreaterThan(0);
    });

    it('uses a safe published logo', () => {
      renderWithProviders(<Header />, {
        user: null,
        ...branded({ brandName: 'Acme Gold', logoUrl: 'https://cdn.example.com/l.png' }),
      });

      const logo = screen.getByRole('img', { name: 'Acme Gold' });
      expect(logo.getAttribute('src')).toBe('https://cdn.example.com/l.png');
    });

    it('ignores an unsafe logo URL', () => {
      renderWithProviders(<Header />, {
        user: null,
        ...branded({ logoUrl: 'javascript:alert(1)' }),
      });

      // The tenant's own logo is kept instead.
      for (const image of screen.queryAllByRole('img')) {
        expect(image.getAttribute('src')).not.toContain('javascript');
      }
    });
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import { MobileNav } from './MobileNav';
import type { HeaderAction, MenuItem } from './Header.types';

let pathname = '/home';
jest.mock('next/navigation', () => ({
  usePathname: () => pathname,
}));

const menus: MenuItem[] = [
  {
    id: 'home',
    label: 'Home',
    url: '/home',
    enabled: true,
    order: 1,
    icon: 'home',
  },
  {
    id: 'vault',
    label: 'Vault',
    url: '/vault',
    enabled: true,
    order: 2,
    children: [
      {
        id: 'passbook',
        label: 'Passbook',
        url: '/vault/passbook',
        enabled: true,
        order: 1,
      },
    ],
  },
  {
    id: 'docs',
    label: 'Docs',
    url: 'https://example.com',
    enabled: true,
    order: 3,
    target: '_blank',
  },
];

const actions: HeaderAction[] = [
  {
    id: 'sign-in',
    label: 'Sign In',
    url: '/login',
    type: 'link',
    enabled: true,
    order: 1,
  },
];

function setup(
  overrides: Partial<React.ComponentProps<typeof MobileNav>> = {},
) {
  const onOpenChange = jest.fn();
  render(
    <MobileNav
      open
      onOpenChange={onOpenChange}
      menus={menus}
      actions={actions}
      {...overrides}
    />,
  );
  return { onOpenChange };
}

describe('MobileNav', () => {
  beforeEach(() => {
    pathname = '/home';
  });

  it('renders nothing while closed', () => {
    setup({ open: false });

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows a titled menu panel with the top level items when open', () => {
    setup();

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Menu')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Home' }).getAttribute('href'),
    ).toBe('/home');
  });

  it('marks the current page link as active', () => {
    setup();

    expect(screen.getByRole('link', { name: 'Home' }).className).toContain(
      'linkActive',
    );
  });

  it('opens external links in a new tab with a safe rel', () => {
    setup();

    const link = screen.getByRole('link', { name: 'Docs' });
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('expands and collapses a parent item to reveal its children', () => {
    setup();
    const parent = screen.getByRole('button', { name: 'Vault' });
    expect(parent.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('link', { name: 'Passbook' })).toBeNull();

    fireEvent.click(parent);
    expect(parent.getAttribute('aria-expanded')).toBe('true');
    expect(
      screen.getByRole('link', { name: 'Passbook' }).getAttribute('href'),
    ).toBe('/vault/passbook');

    fireEvent.click(parent);
    expect(screen.queryByRole('link', { name: 'Passbook' })).toBeNull();
  });

  it('closes the menu after following a link', () => {
    const { onOpenChange } = setup();

    fireEvent.click(screen.getByRole('link', { name: 'Home' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('closes the menu after following a nested link', () => {
    const { onOpenChange } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Vault' }));

    fireEvent.click(screen.getByRole('link', { name: 'Passbook' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('closes from the close button', () => {
    const { onOpenChange } = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Close menu' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows the header actions and closes after using one', () => {
    const { onOpenChange } = setup();

    fireEvent.click(screen.getByRole('link', { name: 'Sign In' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows the profile menu when one is provided', () => {
    setup({ actions: [], profileMenu: <button type="button">Account</button> });

    expect(screen.getByRole('button', { name: 'Account' })).toBeTruthy();
  });

  it('omits the actions area when there are no actions and no profile menu', () => {
    setup({ actions: [] });

    expect(screen.queryByRole('link', { name: 'Sign In' })).toBeNull();
  });
});

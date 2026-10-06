import { fireEvent, render, screen } from '@testing-library/react';
import { NavMenu } from './NavMenu';
import type { MenuItem } from './Header.types';

let pathname = '/home';
jest.mock('next/navigation', () => ({
  usePathname: () => pathname,
}));

const items: MenuItem[] = [
  {
    id: 'home',
    label: 'Home',
    url: '/home',
    enabled: true,
    order: 1,
    icon: 'home',
  },
  {
    id: 'market',
    label: 'Marketplace',
    url: '/marketplace',
    enabled: true,
    order: 2,
  },
  {
    id: 'vault',
    label: 'Vault',
    url: '/vault',
    enabled: true,
    order: 3,
    children: [
      {
        id: 'passbook',
        label: 'Passbook',
        url: '/vault/passbook',
        enabled: true,
        order: 1,
      },
      {
        id: 'redeem',
        label: 'Redeem Gold',
        url: '/vault/redemptions',
        enabled: true,
        order: 2,
      },
    ],
  },
  {
    id: 'docs',
    label: 'Docs',
    url: 'https://example.com/docs',
    enabled: true,
    order: 4,
    target: '_blank',
  },
  {
    id: 'about',
    label: 'About',
    url: '#',
    enabled: true,
    order: 5,
    children: [
      {
        id: 'about-us',
        label: 'About Us',
        url: '/about-us',
        enabled: true,
        order: 1,
      },
    ],
  },
];

function openMenu(name: string) {
  const trigger = screen.getByRole('button', { name });
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
  fireEvent.click(trigger);
}

describe('NavMenu', () => {
  beforeEach(() => {
    pathname = '/home';
  });

  it('renders nothing for an empty menu', () => {
    const { container } = render(<NavMenu items={[]} />);

    expect(container.firstChild).toBeNull();
  });

  it('renders a labelled primary navigation with a link per leaf item', () => {
    render(<NavMenu items={items} />);

    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Home' }).getAttribute('href'),
    ).toBe('/home');
    expect(
      screen.getByRole('link', { name: 'Marketplace' }).getAttribute('href'),
    ).toBe('/marketplace');
  });

  it('marks the link of the current page as active', () => {
    render(<NavMenu items={items} />);

    expect(screen.getByRole('link', { name: 'Home' }).className).toContain(
      'navLinkActive',
    );
    expect(
      screen.getByRole('link', { name: 'Marketplace' }).className,
    ).not.toContain('navLinkActive');
  });

  it('opens external links in a new tab with a safe rel', () => {
    render(<NavMenu items={items} />);

    const link = screen.getByRole('link', { name: 'Docs' });
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('shows an icon when the item has one', () => {
    render(<NavMenu items={items} />);

    expect(
      screen.getByRole('link', { name: 'Home' }).querySelector('svg'),
    ).not.toBeNull();
    expect(
      screen.getByRole('link', { name: 'Marketplace' }).querySelector('svg'),
    ).toBeNull();
  });

  describe('items with children', () => {
    it('keeps children hidden until the menu is opened', () => {
      render(<NavMenu items={items} />);

      expect(screen.queryByRole('link', { name: 'Passbook' })).toBeNull();
    });

    it('lists the children in a dropdown when opened', () => {
      render(<NavMenu items={items} />);

      openMenu('Vault');

      expect(
        screen.getByRole('link', { name: 'Passbook' }).getAttribute('href'),
      ).toBe('/vault/passbook');
      expect(
        screen.getByRole('link', { name: 'Redeem Gold' }).getAttribute('href'),
      ).toBe('/vault/redemptions');
    });

    it('marks the parent active when one of its children is the current page', () => {
      pathname = '/vault/redemptions';
      render(<NavMenu items={items} />);

      expect(screen.getByRole('button', { name: 'Vault' }).className).toContain(
        'navLinkActive',
      );
    });

    it('does not mark the parent active on an unrelated page', () => {
      render(<NavMenu items={items} />);

      expect(
        screen.getByRole('button', { name: 'Vault' }).className,
      ).not.toContain('navLinkActive');
    });

    it('never treats a placeholder # url as the current page', () => {
      pathname = '#';
      render(<NavMenu items={items} />);

      expect(
        screen.getByRole('button', { name: 'About' }).className,
      ).not.toContain('navLinkActive');
    });
  });
});

import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/renderWithProviders';
import { AdminProfileMenu } from './AdminProfileMenu';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

describe('AdminProfileMenu', () => {
  const original = process.env.NEXT_PUBLIC_USE_MOCK_ADMIN_AUTH;

  afterEach(() => {
    if (original === undefined)
      delete process.env.NEXT_PUBLIC_USE_MOCK_ADMIN_AUTH;
    else process.env.NEXT_PUBLIC_USE_MOCK_ADMIN_AUTH = original;
  });

  function openMenu() {
    renderWithProviders(<AdminProfileMenu />);
    fireEvent.click(screen.getByRole('button', { name: 'Admin account menu' }));
  }

  // MainServer has no profile or change-password endpoints yet: the pages would only fail.
  it('offers only logout on a real MainServer sign-in', () => {
    process.env.NEXT_PUBLIC_USE_MOCK_ADMIN_AUTH = 'false';
    openMenu();

    expect(screen.getByRole('button', { name: 'Logout' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Profile' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Update Password' })).toBeNull();
  });

  it('links the profile pages on sample sign-in, where they work', () => {
    process.env.NEXT_PUBLIC_USE_MOCK_ADMIN_AUTH = 'true';
    openMenu();

    expect(
      screen.getByRole('link', { name: 'Profile' }).getAttribute('href'),
    ).toBe('/admin/profile');
    expect(
      screen
        .getByRole('link', { name: 'Update Password' })
        .getAttribute('href'),
    ).toBe('/admin/update-password');
  });
});

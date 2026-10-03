import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/renderWithProviders';
import { ProfileMenu } from './ProfileMenu';

const push = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), push }),
}));

function openMenu() {
  const trigger = screen.getByRole('button', { name: 'Account menu' });
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
  fireEvent.click(trigger);
}

describe('ProfileMenu', () => {
  beforeEach(() => jest.clearAllMocks());

  it('offers a KYC Verification link to the KYC page', () => {
    renderWithProviders(<ProfileMenu />);
    openMenu();

    const link = screen.getByRole('link', { name: 'KYC Verification' });
    expect(link.getAttribute('href')).toBe('/kyc');
  });

  it('still offers logout, which sends the customer to login', () => {
    renderWithProviders(<ProfileMenu />);
    openMenu();

    fireEvent.click(screen.getByRole('button', { name: 'Logout' }));

    expect(push).toHaveBeenCalledWith('/login');
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/renderWithProviders';
import type { SessionUser } from '@/store/session/session.types';
import OtpPage from './(auth)/otp/page';
import ProfileSetupPage from './(auth)/profile-setup/page';
import LoginPage from './(auth)/login/page';
import AuthLayout from './(auth)/layout';

const replace = jest.fn();
let searchParams = new URLSearchParams();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: jest.fn() }),
  useSearchParams: () => searchParams,
}));
jest.mock('@/components/auth/OtpForm/OtpForm', () => ({
  OtpForm: ({ mobileNumber }: { mobileNumber: string }) => <div>otp form for {mobileNumber}</div>,
}));
jest.mock('@/components/auth/ProfileSetupForm/ProfileSetupForm', () => ({
  ProfileSetupForm: () => <div>profile form</div>,
}));
jest.mock('@/components/auth/LoginForm/LoginForm', () => ({
  LoginForm: () => <div>login form</div>,
}));
jest.mock('@/components/auth/AuthShell/AuthShell', () => ({
  AuthShell: ({ children }: { children: React.ReactNode }) => <div data-testid="shell">{children}</div>,
}));

const newUser: SessionUser = {
  userId: '',
  role: 'customer',
  mobileNumber: '9876543210',
  isNewUser: true,
  kycStatus: 'not_started',
};

describe('auth pages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    searchParams = new URLSearchParams();
  });

  describe('login page', () => {
    it('shows the login form', () => {
      render(<LoginPage />);

      expect(screen.getByText('login form')).toBeTruthy();
    });
  });

  describe('auth layout', () => {
    it('wraps pages in the auth shell', () => {
      render(
        <AuthLayout>
          <p>child</p>
        </AuthLayout>,
      );

      expect(screen.getByTestId('shell').textContent).toBe('child');
    });
  });

  describe('otp page', () => {
    it('shows the OTP form for a valid mobile number in the url', () => {
      searchParams = new URLSearchParams({ mobile: '9876543210' });
      render(<OtpPage />);

      expect(screen.getByText('otp form for 9876543210')).toBeTruthy();
      expect(replace).not.toHaveBeenCalled();
    });

    it.each([[''], ['12345'], ['1234567890'], ['abc']])(
      'redirects to login for the invalid mobile %p',
      async (mobile) => {
        searchParams = new URLSearchParams(mobile ? { mobile } : {});
        render(<OtpPage />);

        await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
        expect(screen.queryByText(/otp form/)).toBeNull();
      },
    );
  });

  describe('profile setup page', () => {
    it('shows the form to a customer who is still registering', () => {
      renderWithProviders(<ProfileSetupPage />, { user: newUser });

      expect(screen.getByText('profile form')).toBeTruthy();
      expect(replace).not.toHaveBeenCalled();
    });

    it('sends a visitor without a session to login', async () => {
      renderWithProviders(<ProfileSetupPage />, { user: null });

      await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
      expect(screen.queryByText('profile form')).toBeNull();
    });

    it('sends an already registered customer home', async () => {
      renderWithProviders(<ProfileSetupPage />, { user: { ...newUser, isNewUser: false } });

      await waitFor(() => expect(replace).toHaveBeenCalledWith('/home'));
      expect(screen.queryByText('profile form')).toBeNull();
    });
  });
});

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { ROUTES } from '@/lib/constants/routes';
import { AdminLoginForm } from './AdminLoginForm';

const mockPush = jest.fn();
const mockShowToast = jest.fn();
const mockLogin = jest.fn();
const mockSetup = jest.fn();
const mockVerify = jest.fn();
const mockResetLogin = jest.fn();
const mockResetSetup = jest.fn();
const mockResetVerify = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('@/components/common/Toast/Toast', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));
jest.mock('@/features/admin-auth/hooks/useAdminLogin', () => ({
  useAdminLogin: () => ({ mutateAsync: mockLogin, reset: mockResetLogin }),
}));
jest.mock('@/features/admin-auth/hooks/useAdminTotpSetup', () => ({
  useAdminTotpSetup: () => ({ mutateAsync: mockSetup, reset: mockResetSetup }),
}));
jest.mock('@/features/admin-auth/hooks/useAdminTotpVerify', () => ({
  useAdminTotpVerify: () => ({
    mutateAsync: mockVerify,
    reset: mockResetVerify,
  }),
}));

const enrollmentUri =
  'otpauth://totp/DigiGold:demo-manager?secret=JBSWY3DPEHPK3PXP&issuer=DigiGold';

async function submitCredentials() {
  fireEvent.change(screen.getByLabelText('Username'), {
    target: { value: 'demo-manager' },
  });
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'a-password' },
  });
  const signIn = screen.getByRole('button', { name: 'Sign In' });
  await waitFor(() =>
    expect((signIn as HTMLButtonElement).disabled).toBe(false),
  );
  fireEvent.click(signIn);
}

function enterCode(code: string) {
  fireEvent.change(screen.getByLabelText('Authenticator code'), {
    target: { value: code },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Verify and sign in' }));
}

describe('AdminLoginForm', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockLogin.mockResolvedValue({ temp_token: 'temporary-token' });
    mockSetup.mockResolvedValue({ otpauth_uri: enrollmentUri });
    mockVerify.mockResolvedValue({
      access_token: 'access',
      refresh_token: 'refresh',
    });
  });

  it('enrolls a new admin locally and waits for verification before opening the dashboard', async () => {
    let completeVerification!: (value: unknown) => void;
    mockVerify.mockImplementation(
      () =>
        new Promise((resolve) => {
          completeVerification = resolve;
        }),
    );
    render(<AdminLoginForm />);
    await submitCredentials();

    await screen.findByRole('heading', { name: 'Set up your authenticator' });
    expect(mockLogin).toHaveBeenCalledWith({
      username: 'demo-manager',
      password: 'a-password',
    });
    expect(mockSetup).toHaveBeenCalledWith({ temp_token: 'temporary-token' });
    expect(
      screen.getByRole('img', { name: 'Authenticator enrollment QR code' })
        .tagName,
    ).toBe('svg');
    fireEvent.click(screen.getByText('Can’t scan the QR code?'));
    expect(screen.getByText('JBSWY3DPEHPK3PXP')).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockResetLogin).toHaveBeenCalled();

    enterCode('012345');
    await waitFor(() =>
      expect(mockVerify).toHaveBeenCalledWith({
        temp_token: 'temporary-token',
        code: '012345',
      }),
    );
    expect(mockPush).not.toHaveBeenCalled();
    const verifyButton = screen.getByRole('button', {
      name: 'Verify and sign in',
    });
    expect((verifyButton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(verifyButton);
    expect(mockVerify).toHaveBeenCalledTimes(1);

    await act(async () => {
      completeVerification({
        access_token: 'access',
        refresh_token: 'refresh',
      });
    });
    expect(mockPush).toHaveBeenCalledWith(ROUTES.adminDashboard);
    expect(
      screen.queryByRole('img', { name: 'Authenticator enrollment QR code' }),
    ).toBeNull();
  });

  it('lets an enrolled admin retry an invalid code without repeating password login', async () => {
    mockSetup.mockResolvedValue(null);
    mockVerify.mockRejectedValueOnce({
      message: 'invalid TOTP code',
      status: 401,
    });
    render(<AdminLoginForm />);
    await submitCredentials();

    await screen.findByRole('heading', { name: 'Verify your identity' });
    expect(
      screen.queryByRole('img', { name: 'Authenticator enrollment QR code' }),
    ).toBeNull();
    enterCode('000000');
    expect((await screen.findByRole('alert')).textContent).toBe(
      'That code wasn’t accepted. Enter a fresh six-digit code for your DigiGold admin account. If it still fails, set your device’s date and time to automatic.',
    );
    expect(mockPush).not.toHaveBeenCalled();
    expect(
      (screen.getByLabelText('Authenticator code') as HTMLInputElement).value,
    ).toBe('');

    enterCode('654321');
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(ROUTES.adminDashboard),
    );
    expect(mockLogin).toHaveBeenCalledTimes(1);
    expect(mockVerify).toHaveBeenLastCalledWith({
      temp_token: 'temporary-token',
      code: '654321',
    });
  });

  it('guides enrollment retries to the displayed QR account and keeps the enrollment challenge', async () => {
    mockVerify.mockRejectedValueOnce({
      message: 'invalid TOTP code',
      status: 401,
    });
    render(<AdminLoginForm />);
    await submitCredentials();
    await screen.findByRole('heading', { name: 'Set up your authenticator' });

    enterCode('123456');
    const description =
      'That code wasn’t accepted. Scan the QR code shown here and enter a fresh six-digit code for that account. If it still fails, set your device’s date and time to automatic.';
    expect((await screen.findByRole('alert')).textContent).toBe(description);
    expect(mockShowToast).toHaveBeenCalledWith({
      variant: 'danger',
      title: 'Could not verify code',
      description,
    });
    expect(
      screen.getByRole('img', { name: 'Authenticator enrollment QR code' }),
    ).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
    expect(
      (screen.getByLabelText('Authenticator code') as HTMLInputElement).value,
    ).toBe('');
    expect(mockSetup).toHaveBeenCalledTimes(1);
    expect(mockLogin).toHaveBeenCalledTimes(1);

    enterCode('654321');
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(ROUTES.adminDashboard),
    );
    expect(mockVerify).toHaveBeenLastCalledWith({
      temp_token: 'temporary-token',
      code: '654321',
    });
    expect(mockSetup).toHaveBeenCalledTimes(1);
  });

  it('preserves other verification failures without suggesting a different enrollment', async () => {
    mockVerify.mockRejectedValueOnce({
      message: 'Unable to create admin session',
      status: 500,
    });
    render(<AdminLoginForm />);
    await submitCredentials();
    await screen.findByLabelText('Authenticator code');
    enterCode('123456');

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Unable to create admin session',
    );
    expect(mockPush).not.toHaveBeenCalled();
    expect(
      screen.getByRole('img', { name: 'Authenticator enrollment QR code' }),
    ).toBeTruthy();
  });

  it('surfaces genuine setup failures and retries setup before showing a code form', async () => {
    mockSetup.mockRejectedValueOnce({
      message: 'Unable to save authenticator secret',
      status: 500,
    });
    render(<AdminLoginForm />);
    await submitCredentials();

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Unable to save authenticator secret',
    );
    expect(screen.queryByLabelText('Authenticator code')).toBeNull();
    expect(mockPush).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Retry setup' }));

    await screen.findByRole('heading', { name: 'Set up your authenticator' });
    expect(mockSetup).toHaveBeenCalledTimes(2);
    expect(mockLogin).toHaveBeenCalledTimes(1);
  });

  it.each(['setup', 'verification'])(
    'restarts password login when the temporary token expires during %s',
    async (phase) => {
      const expired = {
        message: 'invalid or expired temporary token',
        status: 401,
      };
      if (phase === 'setup') mockSetup.mockRejectedValueOnce(expired);
      else {
        mockSetup.mockResolvedValue(null);
        mockVerify.mockRejectedValueOnce(expired);
      }
      render(<AdminLoginForm />);
      await submitCredentials();
      if (phase === 'verification') {
        await screen.findByLabelText('Authenticator code');
        enterCode('123456');
      }

      await screen.findByRole('alert');
      expect(screen.getByRole('heading', { name: 'Admin Login' })).toBeTruthy();
      expect(
        (screen.getByLabelText('Password') as HTMLInputElement).value,
      ).toBe('');
      expect(screen.getByRole('alert').textContent).toContain(
        'Enter your password to start again',
      );
      expect(screen.queryByLabelText('Authenticator code')).toBeNull();
      expect(mockPush).not.toHaveBeenCalled();
    },
  );

  it('discards enrollment and clears the password when returning to sign in', async () => {
    render(<AdminLoginForm />);
    await submitCredentials();
    await screen.findByRole('heading', { name: 'Set up your authenticator' });
    fireEvent.click(screen.getByRole('button', { name: 'Back to sign in' }));

    expect(screen.getByRole('heading', { name: 'Admin Login' })).toBeTruthy();
    expect((screen.getByLabelText('Password') as HTMLInputElement).value).toBe(
      '',
    );
    expect(screen.queryByText('JBSWY3DPEHPK3PXP')).toBeNull();
    expect(mockResetSetup).toHaveBeenCalled();
    expect(mockResetVerify).toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('keeps the credentials screen after a rejected password without requesting TOTP setup', async () => {
    mockLogin.mockRejectedValueOnce({
      message: 'Invalid credentials',
      status: 401,
    });
    render(<AdminLoginForm />);
    await submitCredentials();

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Invalid credentials',
    );
    expect(screen.getByLabelText('Username')).toBeTruthy();
    expect(mockSetup).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});

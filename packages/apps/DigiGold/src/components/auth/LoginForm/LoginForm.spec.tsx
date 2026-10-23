import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/renderWithProviders';
import { authService } from '@/features/auth/auth.service';
import { LoginForm } from './LoginForm';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));
jest.mock('@/features/auth/auth.service', () => ({
  authService: {
    requestOtp: jest.fn(),
    verifyOtp: jest.fn(),
    completeProfile: jest.fn(),
  },
}));

const mockedAuth = authService as jest.Mocked<typeof authService>;

const mobileInput = () =>
  screen.getByLabelText('Mobile Number') as HTMLInputElement;
const getOtpButton = () =>
  screen.getByRole('button', { name: /Get OTP/ }) as HTMLButtonElement;

function typeNumber(value: string) {
  fireEvent.change(mobileInput(), { target: { value } });
}

describe('LoginForm', () => {
  beforeEach(() => jest.clearAllMocks());

  it('welcomes the visitor and asks for a mobile number', () => {
    renderWithProviders(<LoginForm />, { user: null });

    expect(screen.getByRole('heading', { name: 'Welcome' })).toBeTruthy();
    expect(mobileInput()).toBeTruthy();
    expect(getOtpButton().disabled).toBe(true);
  });

  it('keeps only digits and at most ten of them', () => {
    renderWithProviders(<LoginForm />, { user: null });

    typeNumber('98a76-54321 099');

    expect(mobileInput().value).toBe('9876543210');
  });

  it('enables Get OTP for a valid Indian mobile number', async () => {
    renderWithProviders(<LoginForm />, { user: null });

    typeNumber('9876543210');

    await waitFor(() => expect(getOtpButton().disabled).toBe(false));
  });

  it('rejects a number that does not start with 6 to 9', async () => {
    renderWithProviders(<LoginForm />, { user: null });

    typeNumber('1234567890');
    fireEvent.blur(mobileInput());

    expect(
      await screen.findByText('Enter a valid 10-digit mobile number'),
    ).toBeTruthy();
    expect(getOtpButton().disabled).toBe(true);
  });

  it('rejects a number that is too short', async () => {
    renderWithProviders(<LoginForm />, { user: null });

    typeNumber('98765');
    fireEvent.blur(mobileInput());

    expect(
      await screen.findByText('Enter a valid 10-digit mobile number'),
    ).toBeTruthy();
  });

  it('requests an OTP and moves to verification', async () => {
    mockedAuth.requestOtp.mockResolvedValue({
      success: true,
      message: 'sent',
      is_registered: false,
    });
    renderWithProviders(<LoginForm />, { user: null });
    typeNumber('9876543210');
    await waitFor(() => expect(getOtpButton().disabled).toBe(false));

    fireEvent.click(getOtpButton());

    expect(
      await screen.findByRole('heading', { name: 'Verify your identity' }),
    ).toBeTruthy();
    expect(mockedAuth.requestOtp.mock.calls[0][0]).toEqual({
      mobileNumber: '9876543210',
    });
  });

  it('shows the local development code when the server returns one', async () => {
    mockedAuth.requestOtp.mockResolvedValue({
      success: true,
      message: 'sent',
      is_registered: false,
      dev_otp: '246810',
    });
    renderWithProviders(<LoginForm />, { user: null });
    typeNumber('9876543210');
    await waitFor(() => expect(getOtpButton().disabled).toBe(false));

    fireEvent.click(getOtpButton());

    expect(await screen.findByText('Local code: 246810')).toBeTruthy();
  });

  it('shows the server message when the OTP cannot be sent', async () => {
    mockedAuth.requestOtp.mockRejectedValue({
      status: 429,
      message: 'Please wait 30 seconds before requesting a new OTP.',
    });
    renderWithProviders(<LoginForm />, { user: null });
    typeNumber('9876543210');
    await waitFor(() => expect(getOtpButton().disabled).toBe(false));

    fireEvent.click(getOtpButton());

    expect(await screen.findByText('Could not send OTP')).toBeTruthy();
    // Once in the toast and once inline, where the on-screen keyboard cannot cover it.
    expect(
      screen.getAllByText('Please wait 30 seconds before requesting a new OTP.'),
    ).toHaveLength(2);
    expect(screen.getByRole('alert').textContent).toBe(
      'Please wait 30 seconds before requesting a new OTP.',
    );
    expect(screen.getByRole('heading', { name: 'Welcome' })).toBeTruthy();
  });

  it('explains a dropped connection in plain words', async () => {
    mockedAuth.requestOtp.mockRejectedValue({
      status: null,
      code: 'ERR_NETWORK',
      message: 'Network Error',
    });
    renderWithProviders(<LoginForm />, { user: null });
    typeNumber('9876543210');
    await waitFor(() => expect(getOtpButton().disabled).toBe(false));

    fireEvent.click(getOtpButton());

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe(
      "Can't reach the server. Check your connection and try again.",
    );
    expect(screen.queryByText('Network Error')).toBeNull();
  });

  it('clears the inline error when the number is edited', async () => {
    mockedAuth.requestOtp.mockRejectedValue({ status: 500, message: 'boom' });
    renderWithProviders(<LoginForm />, { user: null });
    typeNumber('9876543210');
    await waitFor(() => expect(getOtpButton().disabled).toBe(false));
    fireEvent.click(getOtpButton());
    await screen.findByRole('alert');

    typeNumber('987654321');

    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  it('falls back to a generic message for an error without one', async () => {
    mockedAuth.requestOtp.mockRejectedValue('network down');
    renderWithProviders(<LoginForm />, { user: null });
    typeNumber('9876543210');
    await waitFor(() => expect(getOtpButton().disabled).toBe(false));

    fireEvent.click(getOtpButton());

    // Toast and inline message.
    expect(
      await screen.findAllByText('Please check the number and try again.'),
    ).toHaveLength(2);
  });

  it('lets the visitor go back from verification to change the number', async () => {
    mockedAuth.requestOtp.mockResolvedValue({
      success: true,
      message: 'sent',
      is_registered: false,
    });
    renderWithProviders(<LoginForm />, { user: null });
    typeNumber('9876543210');
    await waitFor(() => expect(getOtpButton().disabled).toBe(false));
    fireEvent.click(getOtpButton());
    await screen.findByRole('heading', { name: 'Verify your identity' });

    fireEvent.click(screen.getByRole('button', { name: 'Edit mobile number' }));

    expect(
      await screen.findByRole('heading', { name: 'Welcome' }),
    ).toBeTruthy();
  });

  it('links to the terms and privacy policy', () => {
    renderWithProviders(<LoginForm />, { user: null });

    expect(screen.getByRole('link', { name: 'Terms of Service' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toBeTruthy();
  });
});

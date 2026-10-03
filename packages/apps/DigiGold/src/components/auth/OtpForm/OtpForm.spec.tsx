import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import {
  makeJwt,
  renderWithProviders,
} from '@/test-utils/renderWithProviders';
import { authService } from '@/features/auth/auth.service';
import { OtpForm } from './OtpForm';

const push = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: jest.fn() }),
}));
jest.mock('@/features/auth/auth.service', () => ({
  authService: { requestOtp: jest.fn(), verifyOtp: jest.fn(), completeProfile: jest.fn() },
}));

const mockedAuth = authService as jest.Mocked<typeof authService>;
const MOBILE = '9876543210';

function enterOtp(code: string) {
  fireEvent.paste(screen.getByLabelText('Digit 1'), {
    clipboardData: { getData: () => code },
  });
}

function verifyButton() {
  return screen.getByRole('button', { name: /Verify/ }) as HTMLButtonElement;
}

function tickSeconds(seconds: number) {
  for (let i = 0; i < seconds; i += 1) {
    act(() => {
      jest.advanceTimersByTime(1000);
    });
  }
}

describe('OtpForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('shows who the code was sent to', () => {
    renderWithProviders(<OtpForm mobileNumber={MOBILE} />, { user: null });

    expect(screen.getByRole('heading', { name: 'Verify your identity' })).toBeTruthy();
    expect(screen.getByText(/\+91/)).toBeTruthy();
  });

  it('keeps Verify disabled until all six digits are entered', () => {
    renderWithProviders(<OtpForm mobileNumber={MOBILE} />, { user: null });
    expect(verifyButton().disabled).toBe(true);

    enterOtp('12345');
    expect(verifyButton().disabled).toBe(true);

    enterOtp('123456');
    expect(verifyButton().disabled).toBe(false);
  });

  describe('verifying', () => {
    it('signs a registered customer in and goes home', async () => {
      mockedAuth.verifyOtp.mockResolvedValue({
        success: true,
        message: 'ok',
        is_registered: true,
        access_token: makeJwt({ user_uuid: 'u-1' }),
      });
      const { store } = renderWithProviders(<OtpForm mobileNumber={MOBILE} />, { user: null });
      enterOtp('123456');

      fireEvent.click(verifyButton());

      await waitFor(() => expect(push).toHaveBeenCalledWith('/home'));
      expect(mockedAuth.verifyOtp.mock.calls[0][0]).toEqual({ mobileNumber: MOBILE, otp: '123456' });
      expect(store.getState().session.user?.userId).toBe('u-1');
    });

    it('sends a new number to profile setup', async () => {
      mockedAuth.verifyOtp.mockResolvedValue({
        success: true,
        message: 'ok',
        is_registered: false,
        registration_token: 'reg',
      });
      renderWithProviders(<OtpForm mobileNumber={MOBILE} />, { user: null });
      enterOtp('123456');

      fireEvent.click(verifyButton());

      await waitFor(() => expect(push).toHaveBeenCalledWith('/profile-setup'));
    });

    it('goes to the given success route instead when one is provided', async () => {
      mockedAuth.verifyOtp.mockResolvedValue({
        success: true,
        message: 'ok',
        is_registered: true,
        access_token: makeJwt({ user_uuid: 'u-1' }),
      });
      renderWithProviders(<OtpForm mobileNumber={MOBILE} successRoute="/vault/passbook" />, {
        user: null,
      });
      enterOtp('123456');

      fireEvent.click(verifyButton());

      await waitFor(() => expect(push).toHaveBeenCalledWith('/vault/passbook'));
    });

    it('submits with Enter from a cell', async () => {
      mockedAuth.verifyOtp.mockResolvedValue({
        success: true,
        message: 'ok',
        is_registered: true,
        access_token: makeJwt({ user_uuid: 'u-1' }),
      });
      renderWithProviders(<OtpForm mobileNumber={MOBILE} />, { user: null });
      enterOtp('123456');

      fireEvent.keyDown(screen.getByLabelText('Digit 6'), { key: 'Enter' });

      await waitFor(() => expect(mockedAuth.verifyOtp).toHaveBeenCalledTimes(1));
    });

    it('does not submit an incomplete code with Enter', () => {
      renderWithProviders(<OtpForm mobileNumber={MOBILE} />, { user: null });
      enterOtp('123');

      fireEvent.keyDown(screen.getByLabelText('Digit 1'), { key: 'Enter' });

      expect(mockedAuth.verifyOtp).not.toHaveBeenCalled();
    });

    it('reports an incorrect code and stays on the screen', async () => {
      mockedAuth.verifyOtp.mockRejectedValue({ status: 400, message: 'bad', code: 'X' });
      renderWithProviders(<OtpForm mobileNumber={MOBILE} />, { user: null });
      enterOtp('000000');

      fireEvent.click(verifyButton());

      expect(await screen.findByText('Incorrect OTP')).toBeTruthy();
      expect(push).not.toHaveBeenCalled();
    });

    it('shows the lockout message from the server on rate limiting', async () => {
      mockedAuth.verifyOtp.mockRejectedValue({
        status: 429,
        code: 'ERROR_TOO_MANY_ATTEMPTS',
        message: 'Too many attempts. Try again in 10 minutes.',
      });
      renderWithProviders(<OtpForm mobileNumber={MOBILE} />, { user: null });
      enterOtp('000000');

      fireEvent.click(verifyButton());

      expect(await screen.findByText('Too many attempts')).toBeTruthy();
      expect(screen.getByText('Too many attempts. Try again in 10 minutes.')).toBeTruthy();
    });
  });

  describe('editing the number', () => {
    it('calls the provided handler', () => {
      const onEditNumber = jest.fn();
      renderWithProviders(<OtpForm mobileNumber={MOBILE} onEditNumber={onEditNumber} />, {
        user: null,
      });

      fireEvent.click(screen.getByRole('button', { name: 'Edit mobile number' }));

      expect(onEditNumber).toHaveBeenCalledTimes(1);
      expect(push).not.toHaveBeenCalled();
    });

    it('goes back to the login route when there is no handler', () => {
      renderWithProviders(<OtpForm mobileNumber={MOBILE} />, { user: null });

      fireEvent.click(screen.getByRole('button', { name: 'Edit mobile number' }));

      expect(push).toHaveBeenCalledWith('/login');
    });
  });

  describe('resending', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('shows a 30 second cooldown before Resend is offered', () => {
      renderWithProviders(<OtpForm mobileNumber={MOBILE} />, { user: null });

      expect(screen.getByText('00:30')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Resend Code' })).toBeNull();

      tickSeconds(29);
      expect(screen.queryByRole('button', { name: 'Resend Code' })).toBeNull();

      tickSeconds(1);
      expect(screen.getByRole('button', { name: 'Resend Code' })).toBeTruthy();
    });

    it('resends, clears the code and restarts the cooldown', async () => {
      mockedAuth.requestOtp.mockResolvedValue({
        success: true,
        message: 'sent',
        is_registered: true,
        dev_otp: '654321',
      });
      renderWithProviders(<OtpForm mobileNumber={MOBILE} />, { user: null });
      enterOtp('123456');
      tickSeconds(30);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Resend Code' }));
      });

      expect(mockedAuth.requestOtp.mock.calls[0][0]).toEqual({ mobileNumber: MOBILE });
      expect(screen.getByText('OTP resent')).toBeTruthy();
      expect(screen.getByText('Local code: 654321')).toBeTruthy();
      expect((screen.getByLabelText('Digit 1') as HTMLInputElement).value).toBe('');
      expect(screen.getByText('00:30')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Resend Code' })).toBeNull();
    });

    it('explains the cooldown when resending is rate limited', async () => {
      mockedAuth.requestOtp.mockRejectedValue({
        status: 429,
        message: 'Please wait 30 seconds before requesting a new OTP.',
      });
      renderWithProviders(<OtpForm mobileNumber={MOBILE} />, { user: null });
      tickSeconds(30);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Resend Code' }));
      });

      expect(screen.getByText('Please wait')).toBeTruthy();
      expect(screen.getByText('Please wait 30 seconds before requesting a new OTP.')).toBeTruthy();
    });

    it('reports a generic failure when resending fails for another reason', async () => {
      mockedAuth.requestOtp.mockRejectedValue({ status: 500, message: 'down' });
      renderWithProviders(<OtpForm mobileNumber={MOBILE} />, { user: null });
      tickSeconds(30);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Resend Code' }));
      });

      expect(screen.getByText('Could not resend OTP')).toBeTruthy();
    });
  });
});

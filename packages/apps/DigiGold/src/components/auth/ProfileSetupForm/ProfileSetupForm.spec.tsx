import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/renderWithProviders';
import { authService } from '@/features/auth/auth.service';
import {
  getRegistrationToken,
  setRegistrationToken,
} from '@/lib/auth/tokenStorage';
import type { SessionUser } from '@/store/session/session.types';
import { ProfileSetupForm } from './ProfileSetupForm';

const push = jest.fn();
const replace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
}));
jest.mock('@/features/auth/auth.service', () => ({
  authService: {
    requestOtp: jest.fn(),
    verifyOtp: jest.fn(),
    completeProfile: jest.fn(),
  },
}));

const mockedAuth = authService as jest.Mocked<typeof authService>;

const newUser: SessionUser = {
  userId: '',
  role: 'customer',
  mobileNumber: '9876543210',
  isNewUser: true,
  kycStatus: 'not_started',
};

const nameInput = () => screen.getByLabelText('Full Name') as HTMLInputElement;
const cityInput = () => screen.getByLabelText('City') as HTMLInputElement;

// Fills the two required fields.
function fillRequired(name = 'Jane Doe', city = 'Pune') {
  fireEvent.change(nameInput(), { target: { value: name } });
  fireEvent.change(cityInput(), { target: { value: city } });
}
const submit = () =>
  screen.getByRole('button', { name: 'Create Account' }) as HTMLButtonElement;

describe('ProfileSetupForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.sessionStorage.clear();
    setRegistrationToken('reg-token');
  });

  it('asks for a name, a city and an optional email', () => {
    renderWithProviders(<ProfileSetupForm />, { user: newUser });

    expect(
      screen.getByRole('heading', { name: /get to know you/i }),
    ).toBeTruthy();
    expect(nameInput()).toBeTruthy();
    expect(cityInput()).toBeTruthy();
    expect(screen.getByLabelText('Email (Optional)')).toBeTruthy();
    expect(submit().disabled).toBe(true);
  });

  it('requires a name of at least two characters', async () => {
    renderWithProviders(<ProfileSetupForm />, { user: newUser });

    fireEvent.change(nameInput(), { target: { value: 'J' } });

    expect(await screen.findByText('Enter your full name')).toBeTruthy();
    expect(submit().disabled).toBe(true);
  });

  it('requires a city', async () => {
    renderWithProviders(<ProfileSetupForm />, { user: newUser });
    fireEvent.change(nameInput(), { target: { value: 'Jane Doe' } });
    fireEvent.change(cityInput(), { target: { value: 'P' } });

    expect(await screen.findByText('Enter your city')).toBeTruthy();
    expect(submit().disabled).toBe(true);
  });

  it('rejects an invalid email but accepts leaving it empty', async () => {
    renderWithProviders(<ProfileSetupForm />, { user: newUser });
    fillRequired();
    await waitFor(() => expect(submit().disabled).toBe(false));

    fireEvent.change(screen.getByLabelText('Email (Optional)'), {
      target: { value: 'nope' },
    });
    expect(await screen.findByText('Enter a valid email')).toBeTruthy();
    expect(submit().disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Email (Optional)'), {
      target: { value: '' },
    });
    await waitFor(() => expect(submit().disabled).toBe(false));
  });

  it('creates the account, forgets the registration token and goes home', async () => {
    mockedAuth.completeProfile.mockResolvedValue({
      success: true,
      message: 'ok',
      is_registered: true,
    });
    const { store } = renderWithProviders(<ProfileSetupForm />, {
      user: newUser,
    });
    fillRequired('Jane Doe', 'Pune');
    fireEvent.change(screen.getByLabelText('Email (Optional)'), {
      target: { value: 'jane@example.com' },
    });
    await waitFor(() => expect(submit().disabled).toBe(false));

    fireEvent.click(submit());

    await waitFor(() => expect(push).toHaveBeenCalledWith('/home'));
    expect(mockedAuth.completeProfile.mock.calls[0][0]).toEqual({
      fullName: 'Jane Doe',
      emailId: 'jane@example.com',
      registrationToken: 'reg-token',
      // The city the customer typed, not a placeholder.
      location: 'Pune',
    });
    expect(getRegistrationToken()).toBeNull();
    expect(store.getState().session.user?.isNewUser).toBe(false);
  });

  it('reports a failure and keeps the registration token for a retry', async () => {
    mockedAuth.completeProfile.mockRejectedValue({
      status: 500,
      code: 'ERR_BAD_RESPONSE',
      message: 'down',
    });
    renderWithProviders(<ProfileSetupForm />, { user: newUser });
    fillRequired();
    await waitFor(() => expect(submit().disabled).toBe(false));

    fireEvent.click(submit());

    expect(
      await screen.findByText('Could not create your account'),
    ).toBeTruthy();
    // The reason is shown, in words a customer can act on.
    expect(
      screen.getByText(
        'The server is having trouble right now. Please try again shortly.',
      ),
    ).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
    expect(getRegistrationToken()).toBe('reg-token');
  });

  it('sends the customer back to verify their number when the registration session is gone', async () => {
    window.sessionStorage.clear();
    const { store } = renderWithProviders(<ProfileSetupForm />, {
      user: newUser,
    });
    fillRequired();
    await waitFor(() => expect(submit().disabled).toBe(false));

    fireEvent.click(submit());

    expect(
      await screen.findByText('Your sign-up session expired'),
    ).toBeTruthy();
    expect(mockedAuth.completeProfile).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith('/login');
    expect(store.getState().session.user).toBeNull();
  });

  it('sends the customer back to verify their number when MainServer rejects the registration token', async () => {
    mockedAuth.completeProfile.mockRejectedValue({
      status: 401,
      code: 'ERR_BAD_REQUEST',
      message: 'Registration token has expired',
    });
    renderWithProviders(<ProfileSetupForm />, { user: newUser });
    fillRequired();
    await waitFor(() => expect(submit().disabled).toBe(false));

    fireEvent.click(submit());

    expect(
      await screen.findByText('Your sign-up session expired'),
    ).toBeTruthy();
    expect(replace).toHaveBeenCalledWith('/login');
    expect(getRegistrationToken()).toBeNull();
  });

  it('does nothing for a customer who is already registered', async () => {
    renderWithProviders(<ProfileSetupForm />, {
      user: { ...newUser, isNewUser: false },
    });
    fillRequired();
    await waitFor(() => expect(submit().disabled).toBe(false));

    fireEvent.click(submit());

    await waitFor(() =>
      expect(mockedAuth.completeProfile).not.toHaveBeenCalled(),
    );
    expect(push).not.toHaveBeenCalled();
  });
});

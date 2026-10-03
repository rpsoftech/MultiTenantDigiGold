import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/renderWithProviders';
import { authService } from '@/features/auth/auth.service';
import { getRegistrationToken, setRegistrationToken } from '@/lib/auth/tokenStorage';
import type { SessionUser } from '@/store/session/session.types';
import { ProfileSetupForm } from './ProfileSetupForm';

const push = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: jest.fn() }),
}));
jest.mock('@/features/auth/auth.service', () => ({
  authService: { requestOtp: jest.fn(), verifyOtp: jest.fn(), completeProfile: jest.fn() },
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
const submit = () => screen.getByRole('button', { name: 'Create Account' }) as HTMLButtonElement;

describe('ProfileSetupForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.sessionStorage.clear();
    setRegistrationToken('reg-token');
  });

  it('asks for a name and an optional email', () => {
    renderWithProviders(<ProfileSetupForm />, { user: newUser });

    expect(screen.getByRole('heading', { name: /get to know you/i })).toBeTruthy();
    expect(nameInput()).toBeTruthy();
    expect(screen.getByLabelText('Email (Optional)')).toBeTruthy();
    expect(submit().disabled).toBe(true);
  });

  it('requires a name of at least two characters', async () => {
    renderWithProviders(<ProfileSetupForm />, { user: newUser });

    fireEvent.change(nameInput(), { target: { value: 'J' } });

    expect(await screen.findByText('Enter your full name')).toBeTruthy();
    expect(submit().disabled).toBe(true);
  });

  it('rejects an invalid email but accepts leaving it empty', async () => {
    renderWithProviders(<ProfileSetupForm />, { user: newUser });
    fireEvent.change(nameInput(), { target: { value: 'Jane Doe' } });
    await waitFor(() => expect(submit().disabled).toBe(false));

    fireEvent.change(screen.getByLabelText('Email (Optional)'), { target: { value: 'nope' } });
    expect(await screen.findByText('Enter a valid email')).toBeTruthy();
    expect(submit().disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Email (Optional)'), { target: { value: '' } });
    await waitFor(() => expect(submit().disabled).toBe(false));
  });

  it('creates the account, forgets the registration token and goes home', async () => {
    mockedAuth.completeProfile.mockResolvedValue({
      success: true,
      message: 'ok',
      is_registered: true,
    });
    const { store } = renderWithProviders(<ProfileSetupForm />, { user: newUser });
    fireEvent.change(nameInput(), { target: { value: 'Jane Doe' } });
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
      location: 'India',
    });
    expect(getRegistrationToken()).toBeNull();
    expect(store.getState().session.user?.isNewUser).toBe(false);
  });

  it('reports a failure and keeps the registration token for a retry', async () => {
    mockedAuth.completeProfile.mockRejectedValue({ status: 500, message: 'down' });
    renderWithProviders(<ProfileSetupForm />, { user: newUser });
    fireEvent.change(nameInput(), { target: { value: 'Jane Doe' } });
    await waitFor(() => expect(submit().disabled).toBe(false));

    fireEvent.click(submit());

    expect(await screen.findByText('Could not create your account')).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
    expect(getRegistrationToken()).toBe('reg-token');
  });

  it('refuses to submit when the registration session has expired', async () => {
    window.sessionStorage.clear();
    renderWithProviders(<ProfileSetupForm />, { user: newUser });
    fireEvent.change(nameInput(), { target: { value: 'Jane Doe' } });
    await waitFor(() => expect(submit().disabled).toBe(false));

    fireEvent.click(submit());

    expect(await screen.findByText('Could not create your account')).toBeTruthy();
    expect(mockedAuth.completeProfile).not.toHaveBeenCalled();
  });

  it('does nothing for a customer who is already registered', async () => {
    renderWithProviders(<ProfileSetupForm />, { user: { ...newUser, isNewUser: false } });
    fireEvent.change(nameInput(), { target: { value: 'Jane Doe' } });
    await waitFor(() => expect(submit().disabled).toBe(false));

    fireEvent.click(submit());

    await waitFor(() => expect(mockedAuth.completeProfile).not.toHaveBeenCalled());
    expect(push).not.toHaveBeenCalled();
  });
});

import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/renderWithProviders';
import { adminAuthService } from '@/features/admin-auth/admin-auth.service';
import { AdminProfileView } from './AdminProfileView';

jest.mock('@/features/admin-auth/admin-auth.service', () => ({
  adminAuthService: { getProfile: jest.fn(), updateProfile: jest.fn() },
}));

const mockedService = adminAuthService as jest.Mocked<typeof adminAuthService>;

describe('AdminProfileView', () => {
  beforeEach(() => jest.clearAllMocks());

  it('explains a profile that could not be loaded instead of spinning forever', async () => {
    mockedService.getProfile.mockRejectedValue({
      status: 404,
      code: 'ERR_BAD_REQUEST',
      message: 'Cannot GET /api/v1/admin/profile',
    });
    renderWithProviders(<AdminProfileView />);

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Cannot GET /api/v1/admin/profile',
    );
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows the profile form once it loads', async () => {
    mockedService.getProfile.mockResolvedValue({
      name: 'Asha Admin',
      email: 'asha@example.com',
      phone: '9000000001',
    } as Awaited<ReturnType<typeof adminAuthService.getProfile>>);
    renderWithProviders(<AdminProfileView />);

    expect(
      ((await screen.findByLabelText('Full Name')) as HTMLInputElement).value,
    ).toBe('Asha Admin');
  });
});

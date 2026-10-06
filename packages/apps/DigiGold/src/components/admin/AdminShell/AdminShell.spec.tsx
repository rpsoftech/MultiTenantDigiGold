import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/renderWithProviders';
import { isAdminDataSample } from '@/features/admin/admin.service';
import { AdminShell } from './AdminShell';

jest.mock('@/features/admin/admin.service', () => ({
  isAdminDataSample: jest.fn(),
}));
jest.mock('@/components/admin/AdminProfileMenu/AdminProfileMenu', () => ({
  AdminProfileMenu: () => null,
}));

const mockedSample = jest.mocked(isAdminDataSample);

describe('AdminShell', () => {
  it('says the dashboard figures are samples while the store data is not connected', () => {
    mockedSample.mockReturnValue(true);
    renderWithProviders(
      <AdminShell>
        <p>panel</p>
      </AdminShell>,
    );

    const notice = screen.getByRole('note');
    expect(notice.textContent).toContain('Sample data.');
    expect(notice.textContent).toContain("not DigiGold's records");
    expect(screen.getByText('panel')).toBeTruthy();
  });

  it('shows no notice once real store data is used', () => {
    mockedSample.mockReturnValue(false);
    renderWithProviders(
      <AdminShell>
        <p>panel</p>
      </AdminShell>,
    );

    expect(screen.queryByRole('note')).toBeNull();
  });
});

import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/renderWithProviders';
import TermsOfServicePage from './terms-of-service/page';
import PrivacyPolicyPage from './privacy-policy/page';
import LegalLayout from './layout';

jest.mock('@/components/main/MainShell/MainShell', () => ({
  MainShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="shell">{children}</div>
  ),
}));

describe('legal pages', () => {
  it('shows the terms of service without a login', () => {
    renderWithProviders(<TermsOfServicePage />, { user: null });

    expect(
      screen.getByRole('heading', { level: 1, name: 'Terms of Service' }),
    ).toBeTruthy();
  });

  it('shows the privacy policy without a login', () => {
    renderWithProviders(<PrivacyPolicyPage />, { user: null });

    expect(
      screen.getByRole('heading', { level: 1, name: 'Privacy Policy' }),
    ).toBeTruthy();
  });

  it('wraps pages in the shared header and footer shell', () => {
    renderWithProviders(
      <LegalLayout>
        <p>child</p>
      </LegalLayout>,
      { user: null },
    );

    expect(screen.getByTestId('shell').textContent).toBe('child');
  });
});

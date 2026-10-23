import { render, screen } from '@testing-library/react';
import HomePage from './(main)/home/page';
import PassbookPage from './(main)/vault/passbook/page';
import KycPage from './(main)/kyc/page';
import RedemptionsPage from './(main)/vault/redemptions/page';
import MainLayout from './(main)/layout';

jest.mock('@/components/layout/HomeContent/HomeContent', () => ({
  HomeContent: () => <div>home content</div>,
}));
jest.mock('@/components/vault/Passbook/Passbook', () => ({
  Passbook: () => <div>passbook</div>,
}));
jest.mock('@/components/kyc/Kyc/Kyc', () => ({
  Kyc: () => <div>kyc</div>,
}));
jest.mock('@/components/vault/Redemptions/Redemptions', () => ({
  Redemptions: () => <div>redemptions</div>,
}));
jest.mock('@/components/main/MainShell/MainShell', () => ({
  MainShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="shell">{children}</div>
  ),
}));

describe('main app pages', () => {
  // What the home page draws (published layout or the default storefront) is HomeContent's
  // job and is covered in HomeContent.spec.tsx.
  it('home renders the tenant-driven home content', () => {
    render(<HomePage />);

    expect(screen.getByText('home content')).toBeTruthy();
  });

  it('passbook page shows the passbook', () => {
    render(<PassbookPage />);

    expect(screen.getByText('passbook')).toBeTruthy();
  });

  it('kyc page shows the KYC screen', () => {
    render(<KycPage />);

    expect(screen.getByText('kyc')).toBeTruthy();
  });

  it('redemptions page shows the redemptions screen', () => {
    render(<RedemptionsPage />);

    expect(screen.getByText('redemptions')).toBeTruthy();
  });

  it('the main layout wraps pages in the main shell', () => {
    render(
      <MainLayout>
        <p>child</p>
      </MainLayout>,
    );

    expect(screen.getByTestId('shell').textContent).toBe('child');
  });
});

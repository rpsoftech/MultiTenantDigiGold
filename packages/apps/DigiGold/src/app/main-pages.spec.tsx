import { render, screen } from '@testing-library/react';
import HomePage from './(main)/home/page';
import PassbookPage from './(main)/vault/passbook/page';
import KycPage from './(main)/kyc/page';
import RedemptionsPage from './(main)/vault/redemptions/page';
import MainLayout from './(main)/layout';

jest.mock('@/components/dashboard/PromoCarousel/PromoCarousel', () => ({
  PromoCarousel: () => <div>promo carousel</div>,
}));
jest.mock('@/components/dashboard/CategoryCarousel/CategoryCarousel', () => ({
  CategoryCarousel: () => <div>category carousel</div>,
}));
jest.mock(
  '@/components/dashboard/DashboardEssentials/DashboardEssentials',
  () => ({
    DashboardEssentials: () => <div>dashboard essentials</div>,
  }),
);
jest.mock('@/components/dashboard/TrendingJewelry/TrendingJewelry', () => ({
  TrendingJewelry: () => <div>trending jewelry</div>,
}));
jest.mock('@/components/dashboard/BuyGold/BuyGold', () => ({
  BuyGold: () => <div>buy gold</div>,
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
  // Which sections the home page shows, not their order: arranging them is a layout choice.
  it('home shows every dashboard section', () => {
    render(<HomePage />);

    for (const section of [
      'promo carousel',
      'category carousel',
      'dashboard essentials',
      'trending jewelry',
      'buy gold',
    ]) {
      expect(screen.getByText(section)).toBeTruthy();
    }
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

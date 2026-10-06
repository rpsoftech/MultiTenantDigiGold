import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/renderWithProviders';
import { DEFAULT_TENANT_CONFIG } from '@/features/tenant/tenant.defaults';
import type { FooterConfig } from './Footer.types';
import { useFooterConfig } from './useFooterConfig';
import { Footer } from './Footer';

// Rendering is tested against a fixture: which footer pages are live is site config
// (footer.config.json), checked separately by the navigation routes spec.
jest.mock('./useFooterConfig', () => ({ useFooterConfig: jest.fn() }));
const fixture: FooterConfig = {
  columns: [
    {
      id: 'company',
      label: 'Company',
      enabled: true,
      order: 1,
      links: [
        {
          id: 'about-us',
          label: 'About Us',
          url: '/about-us',
          enabled: true,
          order: 1,
        },
        {
          id: 'vault-security',
          label: 'Vault Security',
          url: '/vault/security',
          enabled: true,
          order: 2,
          icon: 'shield',
        },
      ],
    },
    {
      id: 'legal',
      label: 'Legal',
      enabled: true,
      order: 2,
      links: [
        {
          id: 'privacy-policy',
          label: 'Privacy Policy',
          url: '/privacy-policy',
          enabled: true,
          order: 1,
        },
        {
          id: 'terms-of-service',
          label: 'Terms of Service',
          url: '/terms-of-service',
          enabled: true,
          order: 2,
        },
      ],
    },
    {
      id: 'support',
      label: 'Support',
      enabled: true,
      order: 3,
      links: [
        {
          id: 'help-center',
          label: 'Help Center',
          url: '/help-center',
          enabled: true,
          order: 1,
        },
      ],
    },
  ],
};
beforeEach(() => jest.mocked(useFooterConfig).mockReturnValue(fixture));

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
  ),
}));

describe('Footer', () => {
  it('shows a copyright line with the tenant name and the current year', () => {
    renderWithProviders(<Footer />, {
      preloaded: {
        tenant: {
          config: { ...DEFAULT_TENANT_CONFIG, displayName: 'Acme Jewellers' },
        },
      },
    });

    expect(
      screen.getByText(
        `© ${new Date().getFullYear()} Acme Jewellers. All rights reserved.`,
      ),
    ).toBeTruthy();
  });

  it('falls back to the platform name before a tenant is known', () => {
    renderWithProviders(<Footer />, {
      preloaded: { tenant: { config: null } },
    });

    expect(screen.getByText(/DigiGold\. All rights reserved\./)).toBeTruthy();
  });

  it('shows one labelled navigation per configured column', () => {
    renderWithProviders(<Footer />);

    for (const label of ['Company', 'Legal', 'Support']) {
      expect(screen.getByRole('navigation', { name: label })).toBeTruthy();
    }
  });

  it('links to the configured pages', () => {
    renderWithProviders(<Footer />);

    expect(
      screen.getByRole('link', { name: 'Privacy Policy' }).getAttribute('href'),
    ).toBe('/privacy-policy');
    expect(
      screen
        .getByRole('link', { name: 'Terms of Service' })
        .getAttribute('href'),
    ).toBe('/terms-of-service');
    expect(
      screen.getByRole('link', { name: 'Help Center' }).getAttribute('href'),
    ).toBe('/help-center');
  });

  it('shows the icon configured for a link', () => {
    renderWithProviders(<Footer />);

    expect(
      screen.getByRole('link', { name: 'Vault Security' }).querySelector('svg'),
    ).not.toBeNull();
    expect(
      screen.getByRole('link', { name: 'About Us' }).querySelector('svg'),
    ).toBeNull();
  });

  it('still shows the copyright when no footer page is live yet', () => {
    jest.mocked(useFooterConfig).mockReturnValue({ columns: [] });
    renderWithProviders(<Footer />);

    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.getByText(/All rights reserved\./)).toBeTruthy();
  });
});

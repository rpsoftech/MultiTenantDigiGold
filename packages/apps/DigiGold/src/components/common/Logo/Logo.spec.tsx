import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/renderWithProviders';
import { DEFAULT_TENANT_CONFIG } from '@/features/tenant/tenant.defaults';
import type { TenantConfig } from '@/features/tenant/tenant.types';
import { Logo } from './Logo';

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, style }: { src: string; alt: string; style?: React.CSSProperties }) => (
    <img src={src} alt={alt} style={style} />
  ),
}));

const withTenant = (config: TenantConfig | null) => ({ preloaded: { tenant: { config } } });

describe('Logo', () => {
  it('shows the brand name as text before any tenant is known', () => {
    renderWithProviders(<Logo />, withTenant(null));

    expect(screen.getByText('DigiGold')).toBeTruthy();
  });

  it('shows the tenant logo image with its alt text', () => {
    renderWithProviders(
      <Logo />,
      withTenant({
        ...DEFAULT_TENANT_CONFIG,
        displayName: 'Acme',
        brandLogo: { url: 'https://cdn.example.com/logo.png', alt: 'Acme logo' },
      }),
    );

    const image = screen.getByAltText('Acme logo') as HTMLImageElement;
    expect(image.getAttribute('src')).toBe('https://cdn.example.com/logo.png');
  });

  it('uses the tenant name as alt text when the logo has none', () => {
    renderWithProviders(
      <Logo />,
      withTenant({
        ...DEFAULT_TENANT_CONFIG,
        displayName: 'Acme',
        brandLogo: { url: 'https://cdn.example.com/logo.png', alt: '' },
      }),
    );

    expect(screen.getByAltText('Acme')).toBeTruthy();
  });

  it('falls back to the tenant name as text when the logo has no url', () => {
    renderWithProviders(
      <Logo />,
      withTenant({
        ...DEFAULT_TENANT_CONFIG,
        displayName: 'Acme',
        brandLogo: { url: '', alt: '' },
      }),
    );

    expect(screen.getByText('Acme')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('sizes the image by the requested height', () => {
    renderWithProviders(<Logo height={40} />, withTenant(DEFAULT_TENANT_CONFIG));

    const image = screen.getByRole('img') as HTMLImageElement;
    expect(image.style.height).toBe('40px');
  });
});

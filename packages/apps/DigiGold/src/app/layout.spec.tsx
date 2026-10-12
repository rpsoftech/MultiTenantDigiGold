import { renderToStaticMarkup } from 'react-dom/server';
import { DEFAULT_TENANT_CONFIG } from '@/features/tenant/tenant.defaults';
import { computeTenantCssVars } from '@/features/tenant/tenantCssVars';
import RootLayout, { metadata } from './layout';

jest.mock('./globals.scss', () => ({}), { virtual: true });
jest.mock('./providers', () => ({
  Providers: ({
    children,
    initialTenantConfig,
  }: {
    children: React.ReactNode;
    initialTenantConfig: { displayName: string };
  }) => (
    <div data-testid="providers" data-tenant={initialTenantConfig.displayName}>
      {children}
    </div>
  ),
}));

describe('RootLayout', () => {
  const markup = renderToStaticMarkup(
    <RootLayout>
      <p>page</p>
    </RootLayout>,
  );

  it('sets the page language', () => {
    expect(markup).toContain('<html lang="en">');
  });

  it('inlines the default tenant theme so the first paint is already themed', () => {
    const [firstName, firstValue] = computeTenantCssVars(
      DEFAULT_TENANT_CONFIG,
    )[0];

    expect(markup).toContain('id="tenant-theme-vars"');
    expect(markup).toContain(`${firstName}:${firstValue}`);
    expect(markup).toContain(':root{');
  });

  it('loads the brand font', () => {
    expect(markup).toContain('fonts.googleapis.com');
    expect(markup).toContain('Hanken+Grotesk');
  });

  it('wraps the page in the providers with the default tenant', () => {
    expect(markup).toContain('data-tenant="DigiGold"');
    expect(markup).toContain('<p>page</p>');
  });

  it('exports page metadata', () => {
    expect(metadata.title).toBe('Welcome to DigiGold');
  });
});

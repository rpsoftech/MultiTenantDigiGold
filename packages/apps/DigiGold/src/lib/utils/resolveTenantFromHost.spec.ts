import { resolveTenantFromHost } from './resolveTenantFromHost';

describe('resolveTenantFromHost', () => {
  const defaultTenant = 'aurelian-digital';

  it('resolves a real subdomain to its retailer code', () => {
    expect(resolveTenantFromHost('aurelian.digigold.com', defaultTenant)).toBe('aurelian');
  });

  it('resolves a subdomain with a port to its retailer code', () => {
    expect(resolveTenantFromHost('aurelian.digigold.com:3000', defaultTenant)).toBe('aurelian');
  });

  it('falls back to the default tenant for a bare domain with no subdomain', () => {
    expect(resolveTenantFromHost('digigold.com', defaultTenant)).toBe(defaultTenant);
  });

  it('falls back to the default tenant for a bare "www" domain', () => {
    expect(resolveTenantFromHost('www.digigold.com', defaultTenant)).toBe(defaultTenant);
  });

  it('treats a subdomain after "www" as the retailer code', () => {
    expect(resolveTenantFromHost('www.aurelian.digigold.com', defaultTenant)).toBe('aurelian');
  });

  it('falls back to the default tenant for localhost', () => {
    expect(resolveTenantFromHost('localhost:3000', defaultTenant)).toBe(defaultTenant);
  });

  it('falls back to the default tenant for a loopback IP', () => {
    expect(resolveTenantFromHost('127.0.0.1:3000', defaultTenant)).toBe(defaultTenant);
  });

  it('falls back to the default tenant when there is no host header', () => {
    expect(resolveTenantFromHost(null, defaultTenant)).toBe(defaultTenant);
  });
});

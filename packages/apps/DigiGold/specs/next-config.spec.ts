// The production build refuses sample-data switches that would ship fake sign-in or data.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nextConfig = require('../next.config.js');

describe('next.config production build guard', () => {
  const build = (env: Record<string, string>) => () =>
    nextConfig.assertNoMockDataInBuild(env);

  it('allows a build with every blocked switch off', () => {
    expect(
      build({
        NEXT_PUBLIC_USE_MOCK_AUTH: 'false',
        NEXT_PUBLIC_USE_MOCK_ADMIN: 'false',
        // No catalogue API yet: the marketplace samples are allowed.
        NEXT_PUBLIC_USE_MOCK_MARKETPLACE: 'true',
        NEXT_PUBLIC_USE_MOCK_MARKETPLACE_CATEGORY: 'true',
      }),
    ).not.toThrow();
  });

  it.each([
    'NEXT_PUBLIC_USE_MOCK_AUTH',
    'NEXT_PUBLIC_USE_MOCK_ADMIN_AUTH',
    'NEXT_PUBLIC_USE_MOCK_MARKET',
    'NEXT_PUBLIC_USE_MOCK_PORTFOLIO',
    'NEXT_PUBLIC_USE_MOCK_ADMIN',
  ])('refuses a build with %s on', (flag) => {
    expect(build({ [flag]: 'true' })).toThrow(flag);
  });

  it('allows an explicit demo build', () => {
    expect(
      build({
        NEXT_PUBLIC_USE_MOCK_AUTH: 'true',
        ALLOW_MOCK_DATA_IN_BUILD: 'true',
      }),
    ).not.toThrow();
  });

  it('checks only production builds', () => {
    const original = process.env.NEXT_PUBLIC_USE_MOCK_AUTH;
    process.env.NEXT_PUBLIC_USE_MOCK_AUTH = 'true';
    try {
      expect(nextConfig('phase-development-server').output).toBe('export');
      expect(() => nextConfig('phase-production-build')).toThrow(
        'NEXT_PUBLIC_USE_MOCK_AUTH',
      );
    } finally {
      if (original === undefined) delete process.env.NEXT_PUBLIC_USE_MOCK_AUTH;
      else process.env.NEXT_PUBLIC_USE_MOCK_AUTH = original;
    }
  });
});

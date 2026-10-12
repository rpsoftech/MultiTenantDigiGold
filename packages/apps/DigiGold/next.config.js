//@ts-check

const { PHASE_PRODUCTION_BUILD } = require('next/constants');

// Sample-data switches that must be off in a build customers use: mock sign-in accepts any
// OTP or password, and the others show made-up prices, balances and store data. A build
// reads .env.local too, so a developer's local settings could otherwise slip into a release.
// The marketplace samples are allowed: there is no catalogue API yet (see
// .env.production.example).
const MOCK_FLAGS_BLOCKED_IN_BUILD = [
  'NEXT_PUBLIC_USE_MOCK_AUTH',
  'NEXT_PUBLIC_USE_MOCK_ADMIN_AUTH',
  'NEXT_PUBLIC_USE_MOCK_MARKET',
  'NEXT_PUBLIC_USE_MOCK_PORTFOLIO',
  'NEXT_PUBLIC_USE_MOCK_ADMIN',
];

/**
 * Throws when a production build has a blocked sample-data switch on, unless
 * ALLOW_MOCK_DATA_IN_BUILD=true (e.g. a demo build).
 * @param {Record<string, string | undefined>} env
 */
function assertNoMockDataInBuild(env) {
  if (env.ALLOW_MOCK_DATA_IN_BUILD === 'true') return;
  const enabled = MOCK_FLAGS_BLOCKED_IN_BUILD.filter(
    (flag) => env[flag] === 'true',
  );
  if (enabled.length > 0) {
    throw new Error(
      `Refusing to build with sample data switched on: ${enabled.join(', ')}. ` +
        'Set them to false (check .env.local), or set ALLOW_MOCK_DATA_IN_BUILD=true for a demo build.',
    );
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

/** @param {string} phase */
module.exports = (phase) => {
  if (phase === PHASE_PRODUCTION_BUILD) assertNoMockDataInBuild(process.env);
  return nextConfig;
};

module.exports.assertNoMockDataInBuild = assertNoMockDataInBuild;

const nextJest = require('next/jest.js');

const createJestConfig = nextJest({
  dir: './',
});

const config = {
  displayName: 'DigiGold',
  preset: '../../../jest.preset.js',
  transform: {
    '^(?!.*\\.(js|jsx|ts|tsx|css|json)$)': '@nx/react/plugins/jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../../coverage/packages/apps/DigiGold',
  testEnvironment: 'jsdom',
};

const jestConfig = createJestConfig(config);

module.exports = async () => {
  const resolved = await jestConfig();
  // Disable SWC path alias resolution — handled by the moduleNameMapper entry below.
  for (const value of Object.values(resolved.transform)) {
    if (Array.isArray(value) && value[1]?.resolvedBaseUrl) {
      value[1] = { ...value[1], resolvedBaseUrl: undefined };
    }
  }
  // next/jest doesn't translate tsconfig.json's "@/*" path alias into a moduleNameMapper
  // entry on its own — add it so specs can import app code the same way it's imported
  // in production (@/lib/..., @/features/..., etc.) instead of relative paths.
  resolved.moduleNameMapper = {
    '^@/(.*)$': '<rootDir>/src/$1',
    ...resolved.moduleNameMapper,
  };
  return resolved;
};

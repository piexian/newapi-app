module.exports = {
  projects: [
    {
      displayName: 'app',
      preset: 'jest-expo',
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
      },
      testMatch: ['<rootDir>/__tests__/**/*.test.ts?(x)'],
    },
    {
      displayName: 'plugins',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/__tests__/**/*.test.js'],
    },
  ],
};

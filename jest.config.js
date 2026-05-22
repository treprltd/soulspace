// @ts-check
const nextJest = require('next/jest')

const createJestConfig = nextJest({ dir: './' })

/** @type {import('jest').Config} */
const config = {
  coverageProvider: 'v8',
  testEnvironment: 'node',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  // Live-AI tests (safety classifier + mirror output) require ANTHROPIC_API_KEY.
  // They are excluded from `npm test` and CI unless the key is present.
  // Run them explicitly with: npm run test:safety  or  npm run test:mirror
  testPathIgnorePatterns: [
    '/node_modules/',
    ...(!process.env.ANTHROPIC_API_KEY
      ? ['/__tests__/safety/', '/__tests__/mirror/']
      : []),
  ],
}

module.exports = createJestConfig(config)

// @ts-check
// Load .env.local before evaluating testPathIgnorePatterns so that
// ANTHROPIC_API_KEY is available when the ignore list is built.
// (next/jest only loads env into the test runtime, not the config itself.)
require('dotenv').config({ path: require('path').resolve(__dirname, '.env.local'), override: true })

const nextJest = require('next/jest')

const createJestConfig = nextJest({ dir: './' })

/** @type {import('jest').Config} */
const config = {
  coverageProvider: 'v8',
  testEnvironment: 'node',
  // Adds jest-dom matchers for component tests that opt into jsdom via the
  // `@jest-environment jsdom` docblock (e.g. SeasonVisual, LoopPreview, VoiceInput).
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
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

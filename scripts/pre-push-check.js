#!/usr/bin/env node
/**
 * Soul Space — Pre-push check script
 *
 * Run this before every push to production. It:
 *  1. Runs the full E2E test suite (scripts/e2e-test.js)
 *  2. Writes e2e-report.md
 *  3. Blocks the push if any CRITICAL test fails
 *
 * Usage (PowerShell):
 *   $env:BASE_URL="https://soulspacehealth.org"; node scripts/pre-push-check.js
 *
 * Or point at staging:
 *   $env:BASE_URL="https://dev.soulspacehealth.org"; node scripts/pre-push-check.js
 *
 * Add to git hooks (optional):
 *   cp scripts/pre-push-check.js .git/hooks/pre-push && chmod +x .git/hooks/pre-push
 */

'use strict'

const { execSync } = require('child_process')
const path = require('path')

const reportPath = path.join(__dirname, '..', 'e2e-report.md')

console.log('\n🔍  Running pre-push E2E checks…\n')

try {
  execSync(
    `node ${path.join(__dirname, 'e2e-test.js')} --report`,
    {
      stdio: 'inherit',
      env: { ...process.env, REPORT_PATH: reportPath },
    }
  )
  console.log('\n✅  Pre-push checks passed. Proceeding with push.\n')
  process.exit(0)
} catch {
  console.error('\n❌  Pre-push checks FAILED — push blocked.')
  console.error(`    Review the report: ${reportPath}\n`)
  process.exit(1)
}

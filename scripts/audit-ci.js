#!/usr/bin/env node
/**
 * scripts/audit-ci.js
 *
 * Compliance-aware dependency audit gate (finding #8). Replaces a bare
 * `npm audit --audit-level=critical`, which hard-fails CI on ANY critical in
 * the live advisory database — including transitive criticals whose only fix is
 * a semver-major upgrade the app cannot take yet (the tracked Next.js 14 → 16 /
 * React 19 migration). That made every unrelated PR un-mergeable and broke CI
 * the moment a new advisory was published.
 *
 * Policy:
 *   - CRITICAL with a non-major (patch/minor) fix available  → BLOCK (exit 1).
 *       You can and must take these now.
 *   - CRITICAL whose only fix is semver-major, or no fix      → REPORT (exit 0).
 *       Tracked via docs/compliance-remediation.md + the migration project,
 *       not a per-PR merge blocker.
 *   - ALLOWLIST below explicitly accepts a specific advisory/package.
 *   - Registry/parse failure                                  → WARN (exit 0).
 *       A network hiccup must never block merges.
 *
 * Run: node scripts/audit-ci.js
 */
'use strict'

const { execSync } = require('child_process')

// Advisory URLs/sources or package names explicitly accepted. Document why each
// is here and revisit when the relevant migration lands.
const ALLOWLIST = new Set([
  // e.g. 'https://github.com/advisories/GHSA-xxxx-xxxx-xxxx'
])

function getAudit() {
  try {
    const out = execSync('npm audit --json', {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 24,
    })
    return JSON.parse(out)
  } catch (e) {
    // npm audit exits non-zero when vulnerabilities exist — the JSON is still on
    // stdout in that case.
    if (e && e.stdout) { try { return JSON.parse(e.stdout) } catch { /* fall through */ } }
    return null
  }
}

const audit = getAudit()
if (!audit || !audit.vulnerabilities) {
  console.warn('⚠  Could not obtain a parseable npm audit report (registry error?). Not blocking CI.')
  process.exit(0)
}

const blocking = []
const reported = []

for (const [name, info] of Object.entries(audit.vulnerabilities)) {
  if (info.severity !== 'critical') continue

  const via = Array.isArray(info.via) ? info.via : []
  const advisoryIds = via.filter(v => v && typeof v === 'object').map(v => v.url || String(v.source))
  const titles = via.filter(v => v && typeof v === 'object').map(v => v.title).slice(0, 2).join('; ')

  const fix = info.fixAvailable
  const nonMajorFix = fix === true || (fix && typeof fix === 'object' && fix.isSemVerMajor === false)
  const fixLabel = fix === true
    ? 'available (non-major)'
    : (fix && typeof fix === 'object' && fix.version)
      ? `${fix.name}@${fix.version}${fix.isSemVerMajor ? ' (major)' : ''}`
      : 'none'

  const line = `${name} — ${titles || 'critical'} — fix: ${fixLabel}`
  const allowed = advisoryIds.some(id => ALLOWLIST.has(id)) || ALLOWLIST.has(name)

  if (allowed) reported.push('[allowlisted] ' + line)
  else if (nonMajorFix) blocking.push(line)
  else reported.push(line)
}

const totals = audit.metadata && audit.metadata.vulnerabilities
console.log(`\nDependency audit gate${totals ? ` — totals: ${JSON.stringify(totals)}` : ''}`)

if (reported.length) {
  console.log('\nCriticals REPORTED (major-only/unfixable — tracked, not blocking):')
  reported.forEach(l => console.log('  •', l))
}

if (blocking.length) {
  console.error('\n❌  Criticals with an available non-major fix — MUST be resolved:')
  blocking.forEach(l => console.error('  ✗', l))
  console.error('\nTake the fix (targeted bump / npm update) and re-run.\n')
  process.exit(1)
}

console.log('\n✅  No blocking criticals (nothing with a non-major fix outstanding). Passing.\n')
process.exit(0)

#!/usr/bin/env node
/**
 * scripts/check-bundle-size.js
 *
 * Reads the Next.js build manifest and checks that no individual JS chunk
 * exceeds the maximum allowed gzipped size.
 *
 * Must be run AFTER `npm run build` (reads from .next/).
 * Called from GitHub Actions CI after the build step.
 */

const fs   = require('fs')
const path = require('path')
const zlib = require('zlib')

const MAX_CHUNK_KB    = 500   // gzipped — fail if any page chunk exceeds this
const WARN_CHUNK_KB   = 300   // warn (don't fail) if above this

const BUILD_DIR = path.join(__dirname, '..', '.next')

if (!fs.existsSync(BUILD_DIR)) {
  console.error('❌  .next/ directory not found. Run `npm run build` first.')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Read build manifest to find all JS chunks
// ---------------------------------------------------------------------------
const manifestPath = path.join(BUILD_DIR, 'build-manifest.json')
if (!fs.existsSync(manifestPath)) {
  console.warn('⚠  build-manifest.json not found — skipping bundle size check')
  process.exit(0)
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

// Collect all unique JS file paths referenced in the manifest
const jsFiles = new Set()
for (const files of Object.values(manifest.pages ?? {})) {
  for (const f of files) {
    if (f.endsWith('.js')) jsFiles.add(f)
  }
}

// ---------------------------------------------------------------------------
// Check gzipped size of each chunk
// ---------------------------------------------------------------------------
console.log('\n📦  Bundle size check\n')

let warnings = 0
let errors   = 0
const results = []

for (const relPath of jsFiles) {
  const fullPath = path.join(BUILD_DIR, relPath)
  if (!fs.existsSync(fullPath)) continue

  const raw    = fs.readFileSync(fullPath)
  const gzSize = zlib.gzipSync(raw).length
  const kb     = Math.round(gzSize / 1024)

  results.push({ relPath, kb })
}

// Sort largest first
results.sort((a, b) => b.kb - a.kb)

for (const { relPath, kb } of results) {
  const short = relPath.replace('static/chunks/', '').slice(0, 60)
  if (kb > MAX_CHUNK_KB) {
    console.error(`  ✗  ${kb}KB  ${short}  (OVER ${MAX_CHUNK_KB}KB limit)`)
    errors++
  } else if (kb > WARN_CHUNK_KB) {
    console.warn(`  ⚠  ${kb}KB  ${short}  (warn: over ${WARN_CHUNK_KB}KB)`)
    warnings++
  } else {
    // Only print the top 10 to avoid noise
    if (results.indexOf({ relPath, kb }) < 10) {
      console.log(`  ✓  ${kb}KB  ${short}`)
    }
  }
}

// Print top 10 total
console.log(`\n  Largest chunks:`)
results.slice(0, 10).forEach(({ relPath, kb }) => {
  const short = relPath.replace('static/chunks/', '').slice(0, 70)
  console.log(`    ${String(kb).padStart(5)}KB  ${short}`)
})

console.log('\n' + '─'.repeat(50))
if (errors > 0) {
  console.error(`\n❌  ${errors} chunk(s) exceed the ${MAX_CHUNK_KB}KB limit. Investigate and split.\n`)
  process.exit(1)
} else if (warnings > 0) {
  console.warn(`\n⚠   ${warnings} chunk(s) above ${WARN_CHUNK_KB}KB warning threshold. Consider splitting.\n`)
  process.exit(0)
} else {
  console.log(`\n✅  All chunks within size limits.\n`)
  process.exit(0)
}

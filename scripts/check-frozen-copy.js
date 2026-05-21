#!/usr/bin/env node
/**
 * scripts/check-frozen-copy.js
 *
 * Guards the 6 frozen affirmation strings defined in CLAUDE.md.
 * Searches every .tsx / .ts file in src/ and verifies that the approved
 * text is still present and has not been modified.
 *
 * Run in amplify.yml build phase and in GitHub Actions CI.
 * Exits 0 if all strings are found, 1 if any are missing or changed.
 */

const fs   = require('fs')
const path = require('path')

// ---------------------------------------------------------------------------
// Approved frozen copy — verbatim from CLAUDE.md.
// These strings must appear somewhere in the codebase exactly as written.
// ---------------------------------------------------------------------------
const FROZEN = [
  {
    id: 'resonance-affirm',
    text: 'You do not need to explain everything right away. Let\'s begin with what feels closest.',
    hint: 'Resonance screen affirmation (src/app/session/page.tsx or component)',
  },
  {
    id: 'emotions-affirm',
    text: 'Something here already has a shape. You do not have to name all of it.',
    hint: 'Emotions screen affirmation (src/app/session/emotions/page.tsx or component)',
  },
  {
    id: 'loading-affirm',
    text: 'Not judging. Just trying to find what sits underneath it.',
    hint: 'Mirror loading screen (src/app/session/loading/page.tsx)',
  },
  {
    id: 'output-affirm',
    text: 'This is not a diagnosis. It is what seems to be here, from what you shared.',
    hint: 'Mirror output screen (src/app/session/reflection/page.tsx)',
  },
  {
    id: 'nextstep-affirm',
    text: 'You do not need to resolve anything today. One small thing is enough.',
    hint: 'Next Step screen (src/app/session/next-step/page.tsx)',
  },
  {
    id: 'welcome-affirm',
    text: 'Whatever brought you here — you do not need to have it figured out yet.',
    hint: 'Welcome/Start screen (src/app/start/page.tsx)',
  },
]

// ---------------------------------------------------------------------------
// Collect all .tsx / .ts source files under src/
// ---------------------------------------------------------------------------
function collectFiles(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      collectFiles(full, results)
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      results.push(full)
    }
  }
  return results
}

const SRC_DIR = path.join(__dirname, '..', 'src')
const files   = collectFiles(SRC_DIR)

// Concatenate all source into one big string for substring search.
const rawSource = files.map(f => fs.readFileSync(f, 'utf8')).join('\n')

// Also produce a "flattened" version with JSX tags removed and whitespace
// normalised — handles cases where text is split across <br /> tags or
// wrapped across multiple JSX lines.
const allSource = rawSource
  + '\n'
  + rawSource
      .replace(/<br\s*\/>/g, ' ')          // <br /> → space
      .replace(/<[^>]+>/g, ' ')            // all other tags → space
      .replace(/&rsquo;/g, "'")            // HTML entity → plain apostrophe
      .replace(/&lsquo;/g, "'")
      .replace(/&ldquo;/g, '"')
      .replace(/&rdquo;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&mdash;/g, '—')
      .replace(/&ndash;/g, '–')
      .replace(/\s+/g, ' ')               // collapse whitespace

// ---------------------------------------------------------------------------
// Check each frozen string
// ---------------------------------------------------------------------------
let errors = 0

console.log('\n📋  Frozen affirmation copy guard\n')

for (const { id, text, hint } of FROZEN) {
  if (allSource.includes(text)) {
    console.log(`  ✓  [${id}]`)
  } else {
    console.error(`  ✗  MISSING: [${id}]`)
    console.error(`     Expected text: "${text}"`)
    console.error(`     Hint: ${hint}`)
    errors++
  }
}

console.log('\n' + '─'.repeat(50))
if (errors > 0) {
  console.error(`\n❌  ${errors} frozen string(s) missing or changed.`)
  console.error('    These strings are frozen per CLAUDE.md and must not be modified.\n')
  process.exit(1)
} else {
  console.log('\n✅  All frozen affirmation strings are present and unchanged.\n')
  process.exit(0)
}

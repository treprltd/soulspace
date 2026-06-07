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
// Memory & check-in copy — locked 2026-06-06, carries the same weight as the
// frozen affirmations above (see src/lib/copy/memory.ts header comment and
// MEMORY.md). These live in template literals with interpolated values
// ({{memoryNote}}, {{season}}, {{firstName}}), so each entry is checked as a
// set of static segments — the surrounding skeleton text — rather than one
// exact string. All segments must be found for the entry to pass.
// ---------------------------------------------------------------------------
const MEMORY_FROZEN = [
  {
    id: 'memory-greeting-recent',
    segments: [
      'Welcome back. Last time, something about ',
      " was sitting with you. You don't need to pick up where you left off — just begin wherever you are now.",
    ],
    hint: 'memoryGreeting() — "recent" gap band (src/lib/copy/memory.ts)',
  },
  {
    id: 'memory-greeting-medium',
    segments: [
      "It's been a little while. Last time, you were somewhere in ",
      ' — carrying something about ',
      ". Whatever's true for you today is the right place to start.",
    ],
    hint: 'memoryGreeting() — "medium" gap band (src/lib/copy/memory.ts)',
  },
  {
    id: 'memory-greeting-fallback',
    segments: [
      "It's good to see you again. Things may have shifted since you were last here — or they may not have. Either way, this is a fresh page.",
    ],
    hint: 'memoryGreeting() — universal fallback, used for "long" gap and whenever memory is unavailable (src/lib/copy/memory.ts)',
  },
  {
    id: 'check-in-consent',
    segments: [
      "Soul Space will always gently remember the shape of your last visit when you return — that's just how it works here. If you'd also like to hear from us between visits, every so often, you can turn that on below. Off by default. Change your mind any time in Settings.",
      'About once every couple of weeks, at most. Never more than that.',
    ],
    hint: 'CHECK_IN_CONSENT body + toggleHint (src/lib/copy/memory.ts)',
  },
  {
    id: 'settings-memory-section',
    segments: [
      "Soul Space gently remembers the shape of your last visit, so you never have to start from zero. If you'd also like an occasional note between visits, you can turn that on here — off by default, and changeable any time.",
    ],
    hint: 'SETTINGS_MEMORY_SECTION body (src/lib/copy/memory.ts)',
  },
  {
    id: 'check-in-email-anchored',
    segments: [
      "Last time you visited Soul Space, you were sitting with something about ",
      ". We're not asking you to report back or explain how it's going.",
      "We just wanted you to know: if you'd like a few minutes to sit with whatever's present for you now, the space is here. No pressure, no expectation — just an open door.",
    ],
    hint: 'checkInEmail() — memory-anchored variant body (src/lib/copy/memory.ts)',
  },
  {
    id: 'check-in-email-generic',
    segments: [
      "It's been a little while since your last visit. We're not writing to nudge you back — just to say the space is still here, exactly as you left it.",
      "Whatever's going on for you right now, you don't need to have it figured out before you come back.",
    ],
    hint: 'checkInEmail() — generic-variant body, used when no memory note is available (src/lib/copy/memory.ts)',
  },
  {
    id: 'check-in-email-footer',
    segments: [
      "You're receiving this because you asked Soul Space to check in with you occasionally. Adjust how often, or turn this off, any time in Settings.",
    ],
    hint: 'checkInEmail() — CHECK_IN_FOOTER (src/lib/copy/memory.ts)',
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

console.log('\n📋  Memory & check-in copy guard (locked 2026-06-06)\n')

for (const { id, segments, hint } of MEMORY_FROZEN) {
  const missing = segments.filter(seg => !rawSource.includes(seg) && !allSource.includes(seg))
  if (missing.length === 0) {
    console.log(`  ✓  [${id}]`)
  } else {
    console.error(`  ✗  MISSING/CHANGED: [${id}]`)
    for (const seg of missing) {
      console.error(`     Expected segment: "${seg}"`)
    }
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

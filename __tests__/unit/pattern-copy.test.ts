/**
 * Unit tests — pattern-view copy (src/lib/copy/patterns.ts)
 *
 * Phase 2 build (2026-06-07 scoping note): the lightweight "what you've been
 * carrying" surface — the one remaining gap named repeatedly across two
 * rounds of user research, after memory/check-ins shipped.
 *
 * This copy is DRAFT (not yet locked the way memory/check-in copy is — see
 * the header comment in patterns.ts), but it must still satisfy the same
 * non-negotiable framing rules carried over from CLAUDE.md rule #1
 * ("NEVER write diagnostic or prescriptive language") and from the existing
 * patternInsight micro-moment on /session/next-step:
 *   - Observation, never verdict — "keeps coming up", not "you have a pattern of X"
 *   - Always paired with an explicit non-conclusion disclaimer
 *   - Never clinical/diagnostic phrasing
 *
 * Run with: npm test
 */

import { patternCardCopy, PATTERN_CARD_FALLBACK, PATTERN_CARD_LABEL } from '@/lib/copy/patterns'

// Phrases that would cross from "noticing" into "diagnosing" or "prescribing" —
// mirrors the spirit of the NAGGING_PATTERNS guard in memory-copy.test.ts,
// adapted to the failure modes specific to a pattern-recognition surface.
const DIAGNOSTIC_PATTERNS = [
  /you have a pattern of/i,
  /you (always|never)/i,
  /this (means|indicates|suggests) (you|that you)/i,
  /you should/i,
  /you need to/i,
  /diagnos/i,
  /disorder/i,
  /symptom/i,
  /clinical/i,
]

function assertNeverDiagnoses(text: string) {
  for (const pattern of DIAGNOSTIC_PATTERNS) {
    expect(text).not.toMatch(pattern)
  }
}

describe('patternCardCopy', () => {
  const SAMPLES: Array<[string, number, number]> = [
    ['work or career', 4, 6],
    ['relationships', 2, 3],
    ['a big decision', 3, 8],
  ]

  it('interpolates the situation label and counts', () => {
    const text = patternCardCopy('work or career', 4, 6)
    expect(text).toContain('work or career')
    expect(text).toContain('4')
    expect(text).toContain('6')
  })

  it('always pairs the observation with an explicit non-conclusion disclaimer', () => {
    for (const [label, match, total] of SAMPLES) {
      const text = patternCardCopy(label, match, total)
      expect(text).toMatch(/not a conclusion/i)
    }
  })

  it('frames the observation as something noticed, not a verdict delivered', () => {
    for (const [label, match, total] of SAMPLES) {
      const text = patternCardCopy(label, match, total)
      expect(text).toMatch(/has come up|present/i)
      assertNeverDiagnoses(text)
    }
  })

  it('never uses diagnostic, prescriptive, or clinical language', () => {
    for (const [label, match, total] of SAMPLES) {
      assertNeverDiagnoses(patternCardCopy(label, match, total))
    }
  })
})

describe('PATTERN_CARD_FALLBACK', () => {
  it('is a non-empty, non-diagnostic string', () => {
    expect(PATTERN_CARD_FALLBACK.length).toBeGreaterThan(20)
    assertNeverDiagnoses(PATTERN_CARD_FALLBACK)
  })

  it('does not imply something is missing or wrong about varied sessions', () => {
    expect(PATTERN_CARD_FALLBACK).not.toMatch(/nothing (interesting|useful|meaningful)/i)
    expect(PATTERN_CARD_FALLBACK).not.toMatch(/no pattern (found|detected)/i)
  })
})

describe('PATTERN_CARD_LABEL', () => {
  it('is a short, gentle section label — not a clinical heading', () => {
    expect(PATTERN_CARD_LABEL.length).toBeLessThan(40)
    assertNeverDiagnoses(PATTERN_CARD_LABEL)
    expect(PATTERN_CARD_LABEL).not.toMatch(/pattern (analysis|report|summary)/i)
  })
})

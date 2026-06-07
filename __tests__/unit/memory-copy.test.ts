import {
  classifyReturnGap,
  memoryGreeting,
  checkInEmail,
  CHECK_IN_CONSENT,
  SETTINGS_MEMORY_SECTION,
} from '@/lib/copy/memory'

// Phrases that would signal the "nagging" failure mode named directly in
// beta research — none of the locked copy may ever contain these.
const NAGGING_PATTERNS = [
  /miss you/i,
  /haven'?t (seen|heard from) you/i,
  /it'?s been \d+ days?/i,
  /streak/i,
  /come back!/i,
  /don'?t forget/i,
  /you'?re overdue/i,
]

function assertNeverNags(text: string) {
  for (const pattern of NAGGING_PATTERNS) {
    expect(text).not.toMatch(pattern)
  }
}

describe('classifyReturnGap', () => {
  it('classifies <= 14 days as recent', () => {
    expect(classifyReturnGap(0)).toBe('recent')
    expect(classifyReturnGap(14)).toBe('recent')
  })

  it('classifies 15-42 days as medium', () => {
    expect(classifyReturnGap(15)).toBe('medium')
    expect(classifyReturnGap(42)).toBe('medium')
  })

  it('classifies > 42 days as long', () => {
    expect(classifyReturnGap(43)).toBe('long')
    expect(classifyReturnGap(400)).toBe('long')
  })
})

describe('memoryGreeting', () => {
  it('returns the recent-gap template verbatim when a memory note is present', () => {
    const text = memoryGreeting('recent', 'a tension between staying and leaving a role', 'Winter')
    expect(text).toBe(
      "Welcome back. Last time, something about a tension between staying and leaving a role was sitting with you. You don't need to pick up where you left off — just begin wherever you are now."
    )
  })

  it('returns the medium-gap template verbatim when note + season are present', () => {
    const text = memoryGreeting('medium', 'a decision that kept pulling you back', 'Autumn')
    expect(text).toBe(
      "It's been a little while. Last time, you were somewhere in Autumn — carrying something about a decision that kept pulling you back. Whatever's true for you today is the right place to start."
    )
  })

  it('falls back to the universal long-gap template when memory is missing', () => {
    expect(memoryGreeting('long')).toBe(
      "It's good to see you again. Things may have shifted since you were last here — or they may not have. Either way, this is a fresh page."
    )
  })

  it('falls back to the universal template for "recent" gap with no note (e.g. prior session was safety-flagged)', () => {
    const text = memoryGreeting('recent', null, 'Winter')
    expect(text).toBe(
      "It's good to see you again. Things may have shifted since you were last here — or they may not have. Either way, this is a fresh page."
    )
  })

  it('falls back to the universal template for "medium" gap missing a season', () => {
    const text = memoryGreeting('medium', 'something about work', null)
    expect(text).toContain('fresh page')
  })

  it('never nags or references elapsed time mechanically, in any band', () => {
    assertNeverNags(memoryGreeting('recent', 'a heavy decision', 'Winter'))
    assertNeverNags(memoryGreeting('medium', 'a heavy decision', 'Winter'))
    assertNeverNags(memoryGreeting('long'))
  })

  it('never echoes raw user text — only the Mirror-paraphrased memoryNote string is interpolated', () => {
    // Defensive: confirm the function does no additional quoting/wrapping
    // that could make a paraphrase read as a verbatim quote back at someone.
    const text = memoryGreeting('recent', 'a quiet sense of being unseen at work', 'Spring')
    expect(text).not.toContain('"a quiet sense of being unseen at work"')
    expect(text).toContain('a quiet sense of being unseen at work')
  })
})

describe('checkInEmail', () => {
  it('produces a memory-anchored variant when a note is present', () => {
    const email = checkInEmail('Marcus', 'a tension about a job offer')
    expect(email.greeting).toBe('Hi Marcus,')
    expect(email.body).toContain('a tension about a job offer')
    expect(email.body).toMatch(/not asking you to report back/i)
    expect(email.cta).toMatch(/return to soul space/i)
  })

  it('produces the generic variant when no note is available', () => {
    const email = checkInEmail('Priya', null)
    expect(email.body).toMatch(/still here, exactly as you left it/i)
    expect(email.body).not.toMatch(/sitting with something about/i)
  })

  it('rotates through subject lines deterministically by index', () => {
    const a = checkInEmail('Dan', 'x', 0)
    const b = checkInEmail('Dan', 'x', 1)
    const c = checkInEmail('Dan', 'x', 3) // wraps back to index 0
    expect(a.subject).not.toBe(b.subject)
    expect(a.subject).toBe(c.subject)
  })

  it('every variant carries an inline off-ramp in the footer', () => {
    const withNote = checkInEmail('Greg', 'something about a big move')
    const withoutNote = checkInEmail('Chloe', null)
    expect(withNote.footer).toMatch(/turn this off/i)
    expect(withoutNote.footer).toMatch(/turn this off/i)
  })

  it('never nags, guilts, or references elapsed time / streaks, in any variant', () => {
    assertNeverNags(checkInEmail('Anne', 'a long-carried weight').body)
    assertNeverNags(checkInEmail('Alison', null).body)
    assertNeverNags(checkInEmail('Anne', 'a long-carried weight').subject)
    assertNeverNags(checkInEmail('Alison', null).subject)
  })

  it('always greets by first name with no anonymous fallback (first_name is guaranteed present)', () => {
    expect(checkInEmail('Rosemary', 'x').greeting).toBe('Hi Rosemary,')
  })
})

describe('CHECK_IN_CONSENT (single opt-in toggle — memory itself needs no consent)', () => {
  it('frames memory as default/always-on, not something to switch on', () => {
    expect(CHECK_IN_CONSENT.body).toMatch(/always gently remember/i)
    expect(CHECK_IN_CONSENT.body).toMatch(/off by default/i)
  })

  it('caps the cadence promise at "every couple of weeks" — no higher-frequency option implied', () => {
    expect(CHECK_IN_CONSENT.toggleHint).toMatch(/once every couple of weeks, at most/i)
    expect(CHECK_IN_CONSENT.toggleHint).toMatch(/never more than that/i)
  })
})

describe('SETTINGS_MEMORY_SECTION', () => {
  it('offers only gentle cadence options — no daily/weekly high-frequency choices', () => {
    const values = SETTINGS_MEMORY_SECTION.frequencyOptions.map(o => o.value)
    expect(values).toEqual(['off', 'biweekly', 'monthly'])
    expect(values).not.toContain('daily')
    expect(values).not.toContain('weekly')
  })

  it('every option has a human label', () => {
    SETTINGS_MEMORY_SECTION.frequencyOptions.forEach(opt => {
      expect(opt.label.length).toBeGreaterThan(0)
    })
  })
})

// ── Frozen copy — Memory & Check-ins ───────────────────────────────────────
//
// Locked with the user 2026-06-06, alongside the existing 5 frozen
// affirmation moments (see CLAUDE.md). These strings carry the same weight:
// they are the product's voice at the moment someone returns — which beta
// research (2 convergent rounds) named as *the* trust-defining moment.
//
// Rules for editing this file:
//   - Do not change wording, punctuation, or tone of the locked templates
//     below without the same review process as the 5 frozen affirmations.
//   - Placeholders ({{memoryNote}}, {{season}}, {{firstName}}) may be wired
//     to real data, but the surrounding language must stay verbatim.
//   - scripts/check-frozen-copy.js asserts the static skeleton text is
//     present — if you need to change it, update the guard in lockstep.

export type ReturnGap = 'recent' | 'medium' | 'long'

/**
 * Classify the gap since a user's last visit into the three greeting bands.
 *   recent : within ~2 weeks  (<= 14 days)
 *   medium : 2–6 weeks        (15–42 days)
 *   long   : 6+ weeks         (> 42 days)
 */
export function classifyReturnGap(daysSinceLastVisit: number): ReturnGap {
  if (daysSinceLastVisit <= 14) return 'recent'
  if (daysSinceLastVisit <= 42) return 'medium'
  return 'long'
}

/**
 * The "welcome back" memory greeting — shown at session start to any
 * returning user with a completed, non-safety-flagged prior session.
 * This is a default, always-on behavior (not opt-in): "Soul Space will
 * always gently remember the shape of your last visit" was explicitly
 * approved as the product's baseline, not a feature someone switches on.
 *
 * `memoryNote` is the Mirror-generated third-person paraphrase (e.g.
 * "a tension between staying and leaving a long-held role"); `seasonName`
 * is the human-readable season name (e.g. "Winter"). Both are optional —
 * a returning user with no usable memory (e.g. their only prior session
 * was safety-flagged) still gets the `long`-gap greeting, which needs
 * neither, as a safe universal fallback.
 */
export function memoryGreeting(
  gap: ReturnGap,
  memoryNote?: string | null,
  seasonName?: string | null,
): string {
  const note = memoryNote?.trim()
  const season = seasonName?.trim()

  if (gap === 'recent' && note) {
    return `Welcome back. Last time, something about ${note} was sitting with you. You don't need to pick up where you left off — just begin wherever you are now.`
  }

  if (gap === 'medium' && note && season) {
    return `It's been a little while. Last time, you were somewhere in ${season} — carrying something about ${note}. Whatever's true for you today is the right place to start.`
  }

  // `long` gap, or any band where memory is missing — universal fallback.
  return `It's good to see you again. Things may have shifted since you were last here — or they may not have. Either way, this is a fresh page.`
}

/**
 * The single check-in consent toggle copy (opt-in; off by default).
 * Memory itself needs no consent surface — only being *contacted* does.
 */
export const CHECK_IN_CONSENT = {
  headline: 'Would you like the occasional check-in?',
  body: "Soul Space will always gently remember the shape of your last visit when you return — that's just how it works here. If you'd also like to hear from us between visits, every so often, you can turn that on below. Off by default. Change your mind any time in Settings.",
  toggleLabel: 'Check in with me sometimes',
  toggleHint: 'About once every couple of weeks, at most. Never more than that.',
} as const

/** Settings-page copy for the same control, framed as a permanent home for it. */
export const SETTINGS_MEMORY_SECTION = {
  heading: 'Memory & check-ins',
  body: "Soul Space gently remembers the shape of your last visit, so you never have to start from zero. If you'd also like an occasional note between visits, you can turn that on here — off by default, and changeable any time.",
  toggleLabel: 'Check in with me sometimes',
  frequencyOptions: [
    { value: 'off', label: 'Off' },
    { value: 'biweekly', label: 'Every few weeks' },
    { value: 'monthly', label: 'About monthly' },
  ],
} as const

export interface CheckInEmailContent {
  subject: string
  greeting: string
  body: string
  cta: string
  footer: string
}

const CHECK_IN_SUBJECTS = [
  'Just a quiet check-in from Soul Space',
  'No need to reply — just thinking of you',
  'Whenever you\'re ready',
] as const

const CHECK_IN_FOOTER =
  "You're receiving this because you asked Soul Space to check in with you occasionally. Adjust how often, or turn this off, any time in Settings."

/**
 * Builds the gentle check-in email. `subjectIndex` lets the digest cron
 * rotate subject lines (deterministically, e.g. by send count) rather than
 * always using the same one — purely cosmetic, the body carries the rules.
 *
 * Two variants only:
 *   - memory-anchored: used when the user's last session produced a usable
 *     memoryNote (and was not safety-flagged)
 *   - generic: used otherwise (long gap, no usable note)
 *
 * Neither variant ever mentions elapsed time, streaks, or "we miss you" —
 * that framing was named directly as the failure mode to avoid ("nagging").
 */
export function checkInEmail(
  firstName: string,
  memoryNote?: string | null,
  subjectIndex = 0,
): CheckInEmailContent {
  const subject = CHECK_IN_SUBJECTS[subjectIndex % CHECK_IN_SUBJECTS.length]
  const greeting = `Hi ${firstName},`
  const note = memoryNote?.trim()

  if (note) {
    return {
      subject,
      greeting,
      body: `Last time you visited Soul Space, you were sitting with something about ${note}. We're not asking you to report back or explain how it's going.\n\nWe just wanted you to know: if you'd like a few minutes to sit with whatever's present for you now, the space is here. No pressure, no expectation — just an open door.`,
      cta: 'Return to Soul Space →',
      footer: CHECK_IN_FOOTER,
    }
  }

  return {
    subject,
    greeting,
    body: "It's been a little while since your last visit. We're not writing to nudge you back — just to say the space is still here, exactly as you left it.\n\nWhatever's going on for you right now, you don't need to have it figured out before you come back.",
    cta: 'Return to Soul Space →',
    footer: CHECK_IN_FOOTER,
  }
}

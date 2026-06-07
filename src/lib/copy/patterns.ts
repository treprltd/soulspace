// src/lib/copy/patterns.ts
//
// Copy for the lightweight "what you've been carrying" pattern surface
// (Phase 2 — see the 2026-06-07 scoping note: the one remaining gap named
// by both rounds of user research, after memory/check-ins shipped).
//
// ⚠️ DRAFT — not yet locked. Mirrors the tone and guardrails of the locked
// memory copy in src/lib/copy/memory.ts (CLAUDE.md "Frozen Memory & Check-in
// Copy"), but has not itself been through that review process. Treat as a
// starting point for the same approval pass before shipping broadly — once
// approved, register it in CLAUDE.md and scripts/check-frozen-copy.js
// alongside the other frozen strings.
//
// Non-negotiable framing carried over from the existing patternInsight
// micro-moment on /session/next-step and from CLAUDE.md rule #1
// ("NEVER write diagnostic or prescriptive language"):
//   - Observation, never verdict. "keeps coming up" — not "you have a pattern of X"
//   - Always paired with an explicit non-conclusion disclaimer
//   - Never names emotion_tags directly as clinical-sounding labels —
//     routed through the same human-readable SITUATION_LABELS map used
//     elsewhere (dashboard, /session/next-step)

/**
 * Builds the dashboard "lately, you've been carrying…" pattern card copy.
 *
 * @param situationLabel  Human-readable situation label (e.g. "work or career")
 * @param matchCount      How many of the recent sessions touched this situation
 * @param totalCount      How many recent completed sessions were considered
 */
export function patternCardCopy(situationLabel: string, matchCount: number, totalCount: number): string {
  return `Something about ${situationLabel} has come up in ${matchCount} of your last ${totalCount} visits here. ` +
    `That's not a conclusion about you — just something that's been present more than once.`
}

/**
 * Fallback copy shown when there's enough history to look, but nothing
 * recurs clearly enough to name — keeps the surface from feeling broken
 * or going silent for users who simply have varied sessions.
 */
export const PATTERN_CARD_FALLBACK =
  "You've been showing up here in different ways lately — nothing in particular keeps repeating, and that's its own kind of information."

/** Section label shown above the pattern card. */
export const PATTERN_CARD_LABEL = 'Something you may be noticing'

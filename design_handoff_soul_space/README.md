# Handoff: Soul Space — Design System

## Overview
A complete visual design system for Soul Space — the structured pause between emotional overload and consequential action. Includes brand identity (logo directions, wordmark), the full color & type system, spacing/radii/border tokens, every UI component used in the product, and two functional UI kits showing the marketing landing page and the 10-screen mobile session flow.

## About the Design Files
The files in this bundle are **design references created in HTML/JSX** — prototypes showing intended look and behavior, **not production code to copy directly**.

The Soul Space codebase is **Next.js 14 + Tailwind**. Recreate these designs there using the existing component patterns in `src/components/`. Component class names, the `cn()` helper, and Tailwind tokens already follow this system — extend rather than fork. Where the prototypes show inline styles (because they're standalone HTML), use Tailwind utilities or the existing CSS variables (`var(--gold)`, `var(--mist)`, etc.).

## Fidelity
**High-fidelity.** Final colors, typography, spacing, and interactions are all set. Reproduce pixel-perfectly in the existing Next.js app — the spec values below are the source of truth.

## Design Tokens

### Colors
| Token | Hex | Use |
|---|---|---|
| `--ink` | `#08111C` | Primary background |
| `--ink2` | `#0F1E2E` | Card / inset surface |
| `--ink3` | `#162636` | Subtle elevation |
| `--gold` | `#C9A84C` | Primary accent — the only glow |
| `--gold2` | `#E0BE5C` | Hover/highlight gold |
| `--sand` | `#F5EDD8` | Primary text |
| `--sand2` | `#FFF8E6` | Display text |
| `--mist` | `#8BA7B8` | Secondary text |
| `--mist-55` | `rgba(139,167,184,.55)` | Tertiary copy |
| `--teal2` | `#5FD4BA` | Affirmative / clinical authority |
| `--red` | `#D44040` | Crisis / out-of-scope |
| `--red2` | `#F08585` | Crisis text |
| Season W | `#6B8CAE` | Winter |
| Season Sp | `#2A8C7A` | Spring |
| Season Su | `#C9A84C` | Summer |
| Season Au | `#C4784A` | Autumn |

### Typography
- **Serif (display):** Cormorant Garamond — weights 300 / 400, italic 300/400. Used for headlines, affirmations, season names, all introspective copy.
- **Sans (UI/body):** DM Sans — weights 300/400/500/600/700. Used for buttons, labels, eyebrows, form chrome.
- **Scale:** display 30–42px / h2 24–30px / body 14–17px / label/eyebrow 10–12px UPPERCASE letterspacing .12–.18em.

### Spacing & Radii
- Base spacing: 4 / 8 / 12 / 14 / 18 / 22 / 28 / 32 / 48px.
- Radii: pill 999px (tags, pills, buttons), card 12–14px, hero 16px.
- Borders: hairline `rgba(245,237,216,.06)` for dividers; gold `.18 / .55` for tags & cards; teal `.32–.55` for clinical/affirmative.

## Screens / Views
See `ui_kits/marketing/index.html` and `ui_kits/app/index.html` for the rendered flows.

**Marketing landing** — single long page: hero → resonance phrases → Mirror sample → scope (is/is-not) → footer CTA. Body copy 15–17px, hero subtitle 17px with 1.7 line-height. Gold CTA pill, dark ink text, 700 weight.

**Session flow (mobile-first)** — 10 screens, ~7-minute loop:
1. **Age gate** — three buttons (Under 13 / 13–17 / 18+). No data stored.
2. **Resonance** — pick one of four serif phrases.
3. **Emotions** — multi-select chips (12+ tags). 14px pills, 9×16 padding, border `.22 → .55` when selected.
4. **Intensity** — slider 1–10. Gold thumb with glow.
5. **Context** — 800-char textarea. Italic placeholder.
6. **Loading** — gold spinner + serif copy.
7. **Mirror** — two-column reflection: "carrying" + "underneath" cards, teal "one question back to you" card, **resonance tap** (KEY METRIC). Tap accurate uses mint `#5FD4BA` on `rgba(42,140,122,.22)`; Not quite is dashed mist outline.
8. **Season** — full-bleed season card with icon, name, three-column meta (Grounding / Reflection / Return).
9. **Next step** — single-select action list + write-your-own.
10. **Crisis** — hard gate. 988 + Crisis Text Line. No Mirror output.

## Components
All in `preview/`:
- Buttons (primary gold, outline gold, ghost) — `components-buttons.html`
- Emotion tags — `components-tags.html`
- Resonance tap (KEY METRIC) — `components-resonance-tap.html`
- Mirror card — `components-mirror-card.html`
- Resonance reflection — `components-resonance.html`
- Progress bar — `components-progress.html`
- Intensity slider — `components-intensity.html`
- Form fields — `components-fields.html`
- Nav bars (marketing + session) — `components-navbar.html`
- Scope is / is-not — `components-scope.html`
- Clinical & crisis badges — `components-clinical-badge.html`
- Season hero card — `components-season-card.html`
- Next-step list — `components-next-step.html`

## Interactions & Behavior
- All screen transitions: 280–400ms fade + 6px lift (`@keyframes fadeIn`).
- Loading: 2.2s minimum dwell before Mirror, so the pause feels real.
- Resonance tap is the **single most important data point** — persist locally, send to analytics, surface in admin.
- Crisis branch is a **hard gate** — no Mirror, no Season output. Show 988 + Crisis Text Line immediately.
- Mirror copy in Phase 1 is deterministic from intent template; Phase 2 streams from Claude Sonnet.
- Age gate: no data stored. Under-13 is a hard stop.

## State Management
Already wired in source via `sessionStorage` keys `ss_branch`, `ss_emotions`, `ss_intensity`, `ss_context`. Don't change the keys — Mirror engine reads them.

## Assets
- `assets/logo.svg` — primary wordmark
- `assets/icons/` — season glyphs (Winter, Spring, Summer, Autumn), shield, spinner
- See `preview/brand-logo.html` for 5 logo direction options

## Files
- `README.md` — design system overview
- `colors_and_type.css` — every token as CSS variable
- `tailwind.config.ts` — Tailwind extension (theme tokens)
- `preview/` — every component card (open in browser)
- `ui_kits/marketing/index.html` — landing page mock
- `ui_kits/app/index.html` — 10-screen session flow in a phone frame
- `src/` — original Next.js source from the repo, included for reference

## Doctrine (read before you build)
1. Affirm → Ask → Reflect. Never lead with a question.
2. Non-clinical, non-diagnostic. Never use the words "you are depressed/anxious." Use seasonal language.
3. The gold accent is the **only glow**. Everything else is restrained.
4. If the user expresses crisis intent, the Season is suppressed.
5. The pause is the product. Don't optimize for engagement — optimize for the one-tap resonance.

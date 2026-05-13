# Soul Space — Design System

> **The structured pause between emotional overload and consequential action.**

This design system documents the visual language, content principles, and UI patterns of **Soul Space** — a non-clinical, non-diagnostic web app that helps people understand what they're carrying *before* they decide. Every session follows the same loop: **Affirm → Ask → Reflect.**

This repository captures everything an agent (or designer) needs to make new screens, marketing pages, slides, or prototypes that feel like Soul Space — and *only* Soul Space.

---

## Sources

This system was extracted from the production codebase. None of the assets here are speculative — they are mirrored from the live product.

- **Codebase:** `github.com/treprltd/soulspace` (Next.js 14 App Router + Tailwind).
- **Imported snapshots** live under `src/` in this project (read-only reference): see `src/app/page.tsx`, `src/app/session/**`, `src/app/globals.css`, `tailwind.config.ts`, `src/lib/seasons/index.ts`.
- **Clinical authority:** all Season copy and the five Affirmation moments are *frozen* — clinically reviewed by Dr. Sofia Georgiadou, March 2026. Do not paraphrase.

---

## The Product, in one paragraph

Soul Space is **not** therapy, journaling, meditation, or a chatbot. It is a 3–5 minute structured pause taken before a hard decision or in the middle of emotional overload. The user picks one of four "resonance phrases" (the four branches: A *decision pressure*, B *something unnamed*, C *pattern repeating*, D *carrying alone*), names emotions, rates the weight, writes a paragraph of context, and the **Mirror** (powered by Claude Sonnet, gated by a Haiku safety classifier) returns three short, descriptive paragraphs — *What you're carrying*, *What appears underneath*, *One question back to you* — followed by a **Season** card (Winter / Spring / Summer / Autumn) with a grounding line, a reflection prompt, and a return prompt. If the safety classifier fires, the Season is suppressed entirely and a crisis screen (988 / Crisis Text Line) is shown instead — zero exceptions.

The product surfaces are small:

| Surface | What it is |
|---|---|
| **Marketing site** (`/`) | A single long landing page that introduces the loop and lets the user begin. |
| **Session flow** (`/session/*`) | 8 screens: resonance entry → emotions → intensity → context → loading → mirror → season → next step. |
| **Gates & utility** | Age gate, sign-in (magic link), settings (data control), crisis. |

There is no mobile app, no marketing blog, no dashboard, no chat. The whole product is one quiet loop.

---

## CONTENT FUNDAMENTALS

The voice is the *most* distinctive part of Soul Space — more than the colors, more than the type. Get the voice right and almost anything else can change.

### Tone
- **Quiet, observational, never prescriptive.** Soul Space *describes*, never *diagnoses*.
- **Tentative, not authoritative.** Constant hedges: *"This may feel like…"*, *"What seems to be here…"*, *"Something here already has a shape."* The user is the authority; we just hold up a mirror.
- **Patient.** No urgency, no exclamation marks, no rallying. *"You do not need to resolve anything today."*
- **Permissive.** Almost every screen tells the user they don't have to do something: don't have to explain, don't have to name it all, don't have to decide.
- **Clinically careful.** We never use diagnostic language (*depressed, anxious, traumatized, disorder*). We use somatic, emotional, situational language (*heaviness, what you're carrying, tension*).

### Casing
- **Sentence case** everywhere — headlines, buttons, eyebrows. The only exception is tracked uppercase eyebrows (`STEP 1 OF 3`, `KEY METRIC`), which always render in title-set tracked caps via CSS, never typed as ALLCAPS in copy.
- Buttons use sentence case + a `→` arrow: `Begin →`, `Continue →`, `See your reflection →`.

### Person
- **Second person ("you")** for the user. Always.
- **"Soul Space"** for the product (proper noun) — *not* "we", *not* "the app". E.g. *"Soul Space will be here when you are ready to return."*
- **First person only inside Mirror output**, and only the question back: *"If the deadline disappeared entirely — would the conflict itself change…"*
- Never *we / our / let's* in product copy. The marketing landing page is the one exception (*"We sent a link…"* on the magic-link confirmation).

### Punctuation & typographic quirks
- **Em dashes** are everywhere as a substitute for parenthetical pauses: *"Not therapy. Not meditation. Not a budgeting app — the pause before the decision that changes things."*
- **Sentence fragments are deliberate.** Stacked short fragments are the house rhythm. *"Not judging. Just trying to find what sits underneath it."*
- **Italics carry the gold** — both literally (em is gold2 in CSS) and metaphorically. Use italics for emotional emphasis inside an otherwise plain sentence.
- **Ellipses for in-progress states:** *"Sending…"*, *"Finding the shape…"*, *"Saving…"*.
- **No emoji. Ever.** Soul Space is restrained, not playful.
- **Numbers and decimals follow standard English** (no quirky 1/4 fractions, no symbol substitutions).

### The five frozen affirmation moments
Treat the following as art-locked verbatim copy. Never paraphrase.

1. **Resonance screen** — *"You do not need to explain everything right away. Let's begin with what feels closest."*
2. **Emotions screen** — *"Something here already has a shape. You do not have to name all of it."*
3. **Mirror loading** — *"Not judging. Just trying to find what sits underneath it."*
4. **Mirror output** — *"This is not a diagnosis. It is what seems to be here, from what you shared."*
5. **Next Step** — *"You do not need to resolve anything today. One small thing is enough."*
6. **Welcome screen (pre-session, not one of the five but equally frozen)** — *"Whatever brought you here — you do not need to have it figured out yet."*

### Copy examples to model

| Need | Bad ❌ (off-brand) | Good ✅ (Soul Space) |
|---|---|---|
| CTA on hero | "Start your journey today!" | "Begin your session →" |
| Disabled-button helper | "Please select at least one option to continue." | "More than one can be true." |
| Loading | "Loading…" | "Finding the shape of what you shared." |
| Error | "Oops! Something went wrong." | "Connection error. Please check your internet and try again." |
| Empty state | "No sessions yet. Add one!" | *(Soul Space does not use cheerful empty states — it would simply not show the section.)* |
| Time | "3 minutes" | "3–5 minutes" *(always a range, never precise)* |

---

## VISUAL FOUNDATIONS

### Mood
A candle on a dark wood table. Quiet, near-monastic. Deep navy-black surfaces with warm-gold candlelight accents and faded sand text. Nothing glows, nothing pops. The eye rests.

### Color
- **Background:** `#060E18` — almost black, faintly blue. Never pure black, never grey.
- **Surface stack:** `--ink` `#08111C` (nav) → `--ink2` `#0F1E2E` (cards) → `--ink3` `#162638` (raised). The shift is *barely* perceptible by design — depth comes from hairline borders, not contrast.
- **Primary accent:** **Gold** `#C9A84C`. Used for CTAs, eyebrows, italicised emphasis (via `gold2` `#E8C97A`), and tracked micro-labels. Gold appears against dark only — never on light backgrounds.
- **Body text:** **Sand** `#F5EDD8` (`sand2` `#FAF7F0` for titles). **Mist** `#8BA7B8` for secondary text and captions.
- **Signal:** Teal `#2A8C7A` (Spring / affirmative / "this felt accurate"), Danger `#D44040` (crisis / destructive). Used sparingly.
- **Seasons** are the only place where Soul Space allows itself a coloured background, and even then only at very low alpha: `rgba(...,.97)` over the ink page. Winter = slate blue, Spring = teal, Summer = gold, Autumn = burnt orange. Each season has a four-value cluster: line color, bg (97% alpha), text (light tinted), secondary (mid tinted).

### Type
- **Serif:** **Cormorant Garamond**, light weight (300), often italic. Every headline. Every emphasis. The product *feels* like a serif app.
- **Sans:** **DM Sans** (300–600). All UI chrome, body, buttons, captions.
- **Display rhythm:** Plain serif with one or two italic gold words. *"The structured pause between **emotional overload** and consequential action."* (italic + gold2)
- Type is **small**. Body 11–13px, labels 8–10px, micro-labels 7px. Soul Space whispers; it does not shout. Never larger than ~58px even at hero scale.
- Line-height runs generous (1.6–1.85) — emotional copy *breathes*.
- Eyebrows: 8px DM Sans, `letter-spacing: .18em`, gold, with a 10px gold rule before the text. This is one of the system's strongest motifs — use it.

### Spacing & layout
- Container widths are narrow: `max-w-sm` (384px) for centred utility screens, `max-w-lg` (512px) for sessions, `max-w-xl` (576px) for content sections, `max-w-2xl` (672px) for Mirror output. **The product never sprawls wide.** Even on a 1440px desktop, content sits in a tight column.
- Page padding: 20–24px horizontal, generous vertical (~80–100px between sections on marketing).
- Buttons: 12–14px vertical padding, 16–24px horizontal, `--r-md` 8px corners.
- Cards: 16–24px internal padding, `--r-lg` 12px corners (`--r-xl` 16px on the Season hero).

### Borders, shadows & surfaces
- **Hairline borders** are the depth system. `1px solid rgba(245,237,216,.04)` for the most invisible separators (footer top, settings row dividers), stepping up to `rgba(201,168,76,.12)` for resting cards and `rgba(201,168,76,.45)` for active/selected states.
- **No drop shadows.** None. The only "shadow" in the system is a soft 8px gold glow on the intensity-slider thumb (`0 0 8px rgba(201,168,76,.4)`), and a 60%-opacity linear-gradient top-rule on the Season card. No card carries a box-shadow.
- **Surfaces are alpha layers**, not opaque tints. Cards are typically `rgba(15,30,46,.6)` or `rgba(15,30,46,.8)` so the page background bleeds through subtly.

### Backgrounds & imagery
- The product has **no photography, no illustrations, no patterns, no textures, no gradients on background panels.** Just flat dark surfaces.
- The *one* gradient in the entire codebase is on the intensity-slider fill: `linear-gradient(90deg, rgba(201,168,76,.4), var(--gold))`. The *one* other linear-gradient is the top hairline rule on the Season card: `linear-gradient(90deg, transparent, var(--seasonColor), transparent)`.
- Iconography is custom-drawn SVG, 1.2–1.5px stroke, gold or season-colored, round line-caps, ~40px max. See ICONOGRAPHY below.

### Animation
- **Two animations exist in the codebase, and that is all you should ever need:**
  1. `fadeIn` — 0.4s ease-out, opacity 0→1 + translateY(6px)→0. Applied to every new page via `.animate-fade-in`.
  2. `spin` — 1.2s linear infinite. Used only on the loading spinner.
- **No bounces, no springs, no parallax, no scroll-jacking, no entrance choreography.** Stillness is the brand. If something must transition, it fades. Period.
- **State transitions** are simple `transition-opacity` or `transition-colors` (~150–200ms). Buttons fade to `opacity: 0.9` on hover, `0.8` on active.

### Hover & press states
- **Buttons (primary, gold):** `hover:opacity-90`, `active:opacity-80`. Never grow, never lift.
- **Buttons (outline, gold):** border alpha climbs from `.25` → `.5` on hover. Background stays transparent.
- **Resonance phrases / emotion tags:** border alpha climbs and a faint gold-tint background appears (`rgba(201,168,76,.04)` → `.08` selected). Text color shifts from `sand` → `gold2`.
- **Links in nav / footer:** `text-mist` → `text-sand2` via `transition-colors`.
- **Nothing scales on press.** No `transform: scale()`. Touch feedback is opacity only.

### Transparency & blur
- Transparency is **everywhere** (cards, borders, hover states). Blur is **nowhere** — `backdrop-filter` is unused. Soul Space gets its depth from layered alpha on a single flat background, not from glassmorphism.

### Imagery color vibe (when needed)
- No photography exists in the product. If you must introduce imagery for a marketing pitch deck or external collateral, follow the seasonal palette: deep blue-black skies, candlelight gold, dawn teal, dusk amber. Cool-warm, low-saturation, with grain — never sun-bright, never cold-clinical, never high-contrast. Think *Tarkovsky still*, not stock photo.

### Corner radii
- 6px: small chips (emotion tags use `pill`).
- 8px: buttons.
- 12px: most cards, mirror cards, resonance phrases, surfaces.
- 16px: Season hero card.
- 999px (pill): emotion tags, clinical badges.

### Card anatomy (the three card families)
1. **Plain card** — `bg: rgba(15,30,46,.6)`, `border: 1px solid rgba(245,237,216,.05)`, radius 12, padding 16.
2. **Mirror card** — `bg: var(--ink2)`, `border: 1px solid rgba(201,168,76,.10)`, radius 12, padding 16. Carries a micro-label + a serif italic paragraph.
3. **Season card** — `bg: var(--<S>B)`, `border: 1px solid <seasonColor>22`, radius 16, padding 24, top hairline gradient rule. The only card with a coloured background.

### Layout rules
- One main column. Centred. Sticky 48–56px nav up top with logo left + thin label right.
- Footer (only on marketing) is bottom-centred, tiny logo, fine-print stack, two muted links.
- No sidebars, no tabs, no modals (the crisis screen *replaces* the page, doesn't overlay it).

---

## ICONOGRAPHY

Soul Space uses **only custom hand-drawn SVG icons** — no icon font (e.g. Font Awesome, Lucide, Heroicons), no emoji, no Unicode glyphs except plain ASCII arrows (`→`, `✓`, `✕`) used in copy. There are exactly five icon families in the codebase.

### What's in the system
1. **Season glyphs (4 icons, 44×44, stroke 1.2)** — *Winter* (snowflake + center dot), *Spring* (sprout / sapling), *Summer* (sun + rays), *Autumn* (folded leaves + falling line). One per season, in that season's color. See `assets/icons/season-*.svg`.
2. **The shield (12×12 / 20×20, stroke 1.4–1.5)** — the clinically-reviewed shield. Appears next to the clinical badge on the Season card and on the crisis screen. Always teal or danger-red.
3. **Logo wordmark** — *"Soul"* in sand-serif light + *"Space"* in gold-serif normal, *not* italic. Three sizes: sm/md/lg. No mark, no monogram — Soul Space *is* its wordmark.
4. **Inline text glyphs (typed as characters, not SVGs):**
   - `→` (arrow right) — buttons, links, "Begin →".
   - `✓` (checkmark) — Soul Space *is* lists, teal.
   - `✕` (cross) — Soul Space *is not* lists, danger.
   - `·` (middle dot) — separator between fine-print pieces.
5. **The hairline rule** — `<div class="w-8 h-px bg-gold/20">`. Not strictly an icon, but it's the closest thing Soul Space has to a decorative element. Use it between logo and headline on the welcome and age-gate screens.

### Substitutions / fallbacks
- If you need an icon Soul Space doesn't have, **draw it new** at 24–44px with a 1.2–1.5px stroke, round caps, gold (or season-color), and submit it for review. Do not fall back to an icon library — it will feel instantly off.
- For external collateral (slides, decks) where drawing every icon is impractical, the closest CDN library is **Lucide** (`https://unpkg.com/lucide-static`) — it shares the same stroke weight and round-cap aesthetic. **This is a substitution; flag it.**

### Assets in this folder
- `assets/icons/season-winter.svg`, `assets/icons/season-spring.svg`, `assets/icons/season-summer.svg`, `assets/icons/season-autumn.svg`
- `assets/icons/shield.svg`
- `assets/icons/spinner.svg`
- `assets/logo.svg` (the wordmark assembled as SVG for use outside the codebase)

---

## Index of this folder

```
README.md                         ← you are here
SKILL.md                          ← agent-skill manifest
colors_and_type.css               ← all tokens (CSS vars) + base semantic styles

assets/
  logo.svg                        ← Soul Space wordmark
  icons/                          ← season glyphs, shield, spinner
preview/                          ← Design-System-tab cards (registered, ~22)
fonts/                            ← README pointing to Google Fonts (no local files)
src/                              ← read-only snapshot of source codebase
ui_kits/
  marketing/                      ← /landing page recreations
    index.html
    Hero.jsx, Mirror.jsx, ScopeIsIsNot.jsx, Footer.jsx, Logo.jsx
  app/                            ← session-flow recreations
    index.html
    AgeGate.jsx, Resonance.jsx, Emotions.jsx, Intensity.jsx,
    Context.jsx, Loading.jsx, Mirror.jsx, Season.jsx, NextStep.jsx,
    Crisis.jsx, NavBar.jsx
```

---

## Font substitution flag

Soul Space's two faces — **Cormorant Garamond** and **DM Sans** — are both Google Fonts, so this design system loads them at runtime via the Google Fonts CDN (`fonts/README.md` has the exact import line). No `.ttf`/`.woff2` files are bundled here. If you intend to ship Soul Space offline (e.g. a PDF export for a clinical board), please self-host both families and add them to `fonts/`.

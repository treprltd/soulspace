# Soul Space — App UI Kit

Interactive recreation of the 8-screen session loop + age gate and crisis screen. Click the floating top-right stepper to jump between screens; the natural flow advances on each button.

## Screens

1. **AgeGate** — three-button: Under 13 / 13–17 / 18+. Decorative gold rule, no data stored.
2. **Resonance** — four serif italic phrase tap-targets (the four Branches).
3. **Emotions** — multi-select pill chips, 15 fixed tags.
4. **Intensity** — 1–10 slider with gold-gradient fill and glowing knob.
5. **Context** — free-text up to 800 chars, italic placeholder.
6. **Loading** — spinner + frozen affirmation moment 3 (2.2s in this prototype, ~3–5s in product).
7. **Mirror** — 2-column: 3 Mirror cards on the left, Resonance Tap + Season CTA on the right.
8. **Season** — the only colored card. Switch between W / Sp / Su / Au with the swatches below.
9. **NextStep** — 4 suggestion cards + dashed write-your-own.
10. **Crisis** — replaces (does not overlay) the page. 988 + Crisis Text Line. No Season shown.

All copy is verbatim from the codebase. The Mirror text is the deterministic example from `src/app/page.tsx` (in production it would come from the Claude Sonnet Mirror engine).

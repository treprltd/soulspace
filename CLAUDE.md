# Soul Space — Claude Code Context

## What This Product Is
Soul Space is the structured pause between emotional overload and consequential action.
NOT: therapy, journaling tool, wellness content app, chatbot, or crisis service.
Core loop: Affirm → Ask → Reflect. Every session follows this sequence.

## Tech Stack
- Frontend: Next.js 14 (App Router) + Tailwind CSS
- Database: Supabase (PostgreSQL + RLS + Auth)
- AI Mirror: Claude Sonnet 4.6 (claude-sonnet-4-6)
- AI Safety: Claude Haiku (claude-haiku-4-5-20251001)
- Encryption: AES-256-GCM via Node crypto module
- Hosting: Vercel (frontend) + Supabase (backend)
- Email: Resend
- Auth: Supabase magic link (email only, no passwords)
- Analytics: Self-hosted event table in Supabase only (no 3rd party)

## Non-Negotiable Rules (read every time)
1. NEVER write diagnostic or prescriptive language in any user-facing string.
2. Safety classifier (Haiku) MUST fire before EVERY Mirror API call. No exceptions.
3. Season language is verbatim-approved. Do not modify any Season card text.
4. Affirmation copy at 5 moments is frozen. Do not change it.
5. Crisis gate: when safety_flagged=true, Season is SUPPRESSED. Hard constraint.
6. All session content encrypted AES-256-GCM before storage. Never store plaintext.
7. ANTHROPIC_API_KEY must NEVER appear in code, logs, or client-side bundles.

## Project Structure
```
src/app/              # Next.js App Router pages
src/app/api/          # API routes (Mirror, safety, sessions)
src/components/       # React components by screen
src/lib/mirror/       # Mirror engine (the separable service)
src/lib/safety/       # Safety classifier
src/lib/encryption/   # AES-256-GCM encryption utils
src/lib/seasons/      # Season assignment logic
src/lib/analytics/    # Self-hosted event logging
src/lib/supabase/     # Supabase client helpers
supabase/migrations/  # Database schema and RLS policies
__tests__/            # All test files (Jest)
```

## Key Commands
```bash
npm run dev        # Start local dev server (localhost:3000)
npm run test       # Run full test suite (Jest)
npm run test:safety  # Run safety classifier tests only
npm run test:mirror  # Run Mirror output test suite (30 cases)
npm run lint       # ESLint check
npm run build      # Production build check
npm run typecheck  # TypeScript type check
```

## Environments
- Local: localhost:3000 (NEXT_PUBLIC_ENV=local)
- Dev: dev.soulspacehealth.org (NEXT_PUBLIC_ENV=dev)
- Test: test.soulspacehealth.org (NEXT_PUBLIC_ENV=test)
- Production: soulspacehealth.org (NEXT_PUBLIC_ENV=production)

## The Four Resonance Branches
- A (decision_pressure): "Something keeps pulling you back to a decision you thought you'd made."
- B (something_unnamed): "You know what you feel but can't quite explain why."
- C (pattern_repeating): "You're not in crisis. But something isn't right."
- D (carrying_alone): "You've been carrying this alone for a while."

## Frozen Affirmation Copy (5 moments — do not change)
1. Resonance screen: "You do not need to explain everything right away. Let's begin with what feels closest."
2. Emotions screen: "Something here already has a shape. You do not have to name all of it."
3. Mirror loading: "Not judging. Just trying to find what sits underneath it."
4. Mirror output: "This is not a diagnosis. It is what seems to be here, from what you shared."
5. Next Step: "You do not need to resolve anything today. One small thing is enough."
Welcome screen: "Whatever brought you here — you do not need to have it figured out yet."

## Key Metric
Binary resonance tap after Mirror output: "This felt accurate" / "Not quite"
Target: >60% accurate. If below 50% — stop all work and fix Mirror.

## Phase 1 Screens (13 shipping)
Age Gate → Welcome/Scope → Resonance Entry → Emotions → Intensity → Context →
Mirror Loading → Mirror Output → Season (×4 variants) → Next Step → Crisis → Settings

# Soul Space — Android & iOS Apps: Build & Launch Analysis

*Prepared July 2026 · Grounded in the current production codebase (Next.js 14 App Router,
Supabase magic-link auth, Stripe subscriptions, Brevo email, AWS Amplify hosting).*

---

## 1. Executive summary & recommendation

Soul Space today is a server-rendered web product: Next.js pages backed by API routes that
hold the safety pipeline (Haiku classifier → Claude Mirror), AES-256-GCM encryption, Stripe
billing, and the analytics/event system. None of that server side moves into a mobile app —
whatever we ship on phones is a **client** for the same backend.

**Recommended path — three phases, each shippable on its own:**

| Phase | What | Effort | Outcome |
|---|---|---|---|
| **0 — PWA baseline** | Manifest, icons, service worker, offline page | 2–4 days | Installable "app" on Android + iOS home screens today; produces the icon/splash assets Phase 1 needs anyway |
| **1 — Store apps (Capacitor)** | Native shells wrapping the product, plus real native capabilities: push notifications, biometric app-lock, magic-link deep links | 2–4 weeks build + 1–3 weeks store review/testing gates | Soul Space listed in the App Store and Play Store |
| **2 — Native rebuild (Expo/React Native)** | Full native UI consuming the existing API routes | 2–4 months | Only justified once store traction proves demand; not now |

Phase 1 is the earliest realistic "live in both stores" milestone. The gating items are not
code — they are **store policy** (Apple's in-app-purchase rule for the $9.99/$19.99
subscriptions, Apple's minimum-functionality rule for wrapped apps, both stores'
sensitive-content rules) and **account/testing prerequisites** (Google's mandatory 14-day
closed test for new individual accounts). Those are analyzed in §4–§6 and drive the plan more
than any engineering choice.

---

## 2. What we're starting from — architecture inventory

**Transfers to mobile as-is (backend, untouched):**
- All API routes: mirror + regenerate, safety classifier gate, sessions, subscription,
  events, feedback, contact, digest/lifecycle emails
- Supabase auth (magic link), RLS, encrypted session content
- Stripe billing + webhooks; Brevo email; admin panel (stays web-only)

**Transfers with adaptation (client):**
- The entire 13-screen session flow renders fine in a WebView (recent type-scale and
  responsiveness work was verified at 375px)
- Magic-link sign-in: the new `/auth/email?token_hash=…` bridge (shipped July 2026) is
  exactly the deep-link entry an app needs — an emailed CTA can open the **app** already
  signed in via Universal Links / App Links
- Account deletion: `/api/user/data` DELETE is wired into Settings — satisfies Apple's
  in-app account-deletion requirement out of the box

**Does not transfer / needs native work:**
- **Voice input** uses the browser `SpeechRecognition` API — unavailable in iOS WKWebView
  and Android WebView. The component already feature-detects and hides itself, so nothing
  breaks; voice is simply absent in the wrapped app until we add a native speech plugin
  (e.g. `@capacitor-community/speech-recognition`). Acceptable gap for launch; voice is a
  paid-tier nicety, not the core loop.
- **Web push/PWA surface**: none exists yet (no manifest, no service worker, no icons) —
  that is Phase 0.
- **Stripe web checkout** cannot simply be shown inside the iOS app (see §4.1 — the single
  biggest policy decision).

---

## 3. The four routes compared

| | **A. PWA only** | **B. Capacitor wrapper** ✅ recommended | **C. Expo / React Native** | **D. Full native (Swift/Kotlin)** |
|---|---|---|---|---|
| What it is | Installable web app from the browser | Native shells (real store apps) hosting the web UI, plus native plugins | New native UI in RN, reusing the backend | Two separate native codebases |
| Store presence | ❌ none | ✅ both stores | ✅ both stores | ✅ both stores |
| Code reuse | 100% | ~95% (web UI reused; native glue added) | Backend reused; **UI rebuilt** | Backend reused; everything else rebuilt |
| Native capabilities | Very limited on iOS | Push, biometrics, haptics, deep links, share | Full | Full |
| Effort to live | 2–4 days | 2–4 weeks + review | 2–4 months | 4–8+ months |
| Ongoing cost | ~zero | Low (web changes flow through automatically) | Medium (second UI to maintain) | High (third and fourth codebases) |
| Main risk | Not "in the store" | Apple 4.2 minimum-functionality rejection if shipped as a bare wrapper | Timeline + split focus during beta | Cost/absurd for current stage |
| Feel | Good | Good-to-great if native touches are real | Great | Great |

**Why B:** at 54 users and an active university-outreach motion, the goal is store
presence + installability + push, at minimum maintenance cost, without freezing the web
product (which is still changing weekly). Capacitor gives that. C becomes the right call
only when retention data justifies a dedicated mobile experience.

**Apple 4.2 mitigation (must-do, not optional):** Apple rejects apps that are "simply a
website in a shell." The Phase 1 build therefore ships with genuinely native behavior:
1. **Push notifications** (APNs/FCM) — the mobile sibling of the lifecycle emails
2. **Biometric app-lock** (Face ID / fingerprint before the space opens) — a *perfect* fit
   for a privacy-first emotional product, and a visible native feature reviewers notice
3. **Native haptics** on key moments (resonance tap, season reveal)
4. **Offline state** — a designed "you're offline; the space will be here" screen
5. App opens full-screen with native splash, no browser chrome, deep links registered

---

## 4. Store-policy analysis (the part that actually gates launch)

### 4.1 Subscriptions — the biggest decision
Apple Guideline 3.1.1: digital services unlockable **in the app** must use Apple In-App
Purchase (15% rate under the Small Business Program at our scale, not 30%). Google Play
Billing is the same idea. Three postures:

| Posture | How it works | Trade-off |
|---|---|---|
| **"Login-only" (recommended for launch)** | App never sells or links to purchase. Free tier fully works; paid features light up for users who subscribed on the website. Netflix/Kindle model — long-standing, compliant. | No in-app conversion; upgrade discovery happens on web/email (which we already drive) |
| US external-purchase link | Post-*Epic* injunction, US storefront apps may link out to web checkout | US-only, still review-sensitive, extra disclosure UI |
| Adopt IAP/Play Billing | Sell Essentials/Insights in-app | 15% fee, second billing system to reconcile with Stripe (entitlement merge work) — do this later if mobile converts |

Launch with login-only; revisit IAP when mobile installs are material.

### 4.2 Sensitive-content & wellness rules — we are unusually well-positioned
- **Not therapy / not medical:** Soul Space's own frozen positioning ("non-clinical,
  non-diagnostic, not a crisis service") is exactly what Apple 1.4 / Play Health policies
  want stated. Store descriptions must repeat it.
- **Self-harm handling:** both stores require careful crisis treatment. The hard-coded
  crisis gate (safety classifier before every Mirror, Season suppression, 988 routing) is a
  *strength* — document it in the review notes.
- **Age rating:** the product already enforces an age gate. Rate 17+/Mature Themes on
  Apple, Teen+ on Play; keep the in-app age gate.
- **Account deletion:** required by Apple since 2022 — already implemented ✓
- **Privacy labels / Data Safety form:** genuinely strong story — no third-party trackers,
  no ads, AES-256-GCM content encryption, self-hosted analytics. Fill honestly; this is a
  differentiator, not a chore.
- **Encryption export compliance:** standard HTTPS/AES → exempt self-classification
  (`ITSAppUsesNonExemptEncryption = NO` plus the annual French declaration if distributing
  in France).

### 4.3 Review-notes package (prepare once, reuse both stores)
Demo account with a pre-seeded session; explanation of the safety pipeline; the
"not therapy" scope statement; crisis-flow walkthrough; privacy summary. Apple reviewers of
wellness apps look for exactly these.

---

## 5. Technical design — Phase 1 (Capacitor)

- **Shell strategy:** Capacitor with `server.url` pointed at the production site (remote
  content). The Next.js app keeps its server routes; the app auto-receives every web deploy
  with no store re-review (policy-safe: Apple permits remote web content for hybrid apps;
  only *native binary* changes need review).
- **Auth deep links:** register `https://soulspacehealth.org/auth/*` as Universal Links
  (iOS `apple-app-site-association`) and App Links (Android `assetlinks.json`). The emailed
  sign-in CTA then opens the **app** at `/auth/email?token_hash=…` → already-shipped bridge
  signs the user in natively. Fallback custom scheme `soulspace://`.
- **Push notifications:** Capacitor Push plugin → FCM + APNs. Content mirrors the lifecycle
  system's rules: opt-in, once-per-moment, no "we miss you" framing (the locked beta
  research applies to every channel). Requires a small `device_tokens` table + send hook in
  the existing digest cron — the scheduling/cooldown logic is already built.
- **Biometric lock:** `capacitor-native-biometric` gate on app foreground (setting, default
  off). High privacy value, near-zero effort.
- **Voice input:** hidden automatically (feature detection already in place); add native
  speech plugin post-launch if paid users ask.
- **`tel:` links** (988 crisis line) — verify WebView hands off to the dialer on both
  platforms during QA; this is a safety-critical test case.
- **Builds/CI:** Xcode + Android Studio locally or via Ionic Appflow/Codemagic;
  release-signing keys stored offline (Play App Signing for Android).

---

## 6. Accounts, costs, and non-code gates

| Item | Cost | Lead time / gotcha |
|---|---|---|
| Apple Developer Program | $99/yr | Individual is fast; **Organization needs a D-U-N-S number** (days–weeks). Decide entity now. |
| Small Business Program (15% IAP rate, if ever needed) | free | Enroll after account exists |
| Google Play Console | $25 once | **New individual accounts must run a closed test with ≥12 testers for 14 continuous days before production access.** This is the single longest fixed gate on Android — start it the week the account exists. |
| App icons/splash (from Phase 0 assets) | design time | 1024px master + adaptive Android set |
| Store screenshots (6.7"/6.5"/5.5" iOS, phone+tablet Play) | half a day | Produce from the live product at device sizes |
| Privacy policy URL | ✓ exists (`/privacy`) | Add app-specific data-collection lines |
| Demo/review account | free | Seed one completed session |

**Realistic calendar to "live in both stores":** ~4–7 weeks — Phase 0 (week 1), Capacitor
build + native features (weeks 1–3), Google closed-test clock (weeks 2–4, runs in
parallel), store metadata + review cycles including one assumed Apple rejection/resubmit
(weeks 4–7).

---

## 7. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Apple 4.2 "just a website" rejection | Medium | Ship the four native features in §3; write review notes that lead with them |
| IAP dispute over subscription | Low with login-only posture | No purchase, no link-out, no price mention in the iOS app |
| Wellness-content scrutiny slows review | Medium | Review-notes package (§4.3); crisis flow demo |
| Google 14-day closed-test forgotten until the end | High if unplanned | Start the day the Play account exists |
| Magic-link emails open in browser instead of app | Medium | Universal/App Links + `/auth/email` bridge; test with Gmail/Apple Mail specifically |
| Push copy drifts into "nagging" | Medium | Same review process as frozen email copy before any push template ships |

---

## 8. Decisions needed before Phase 1 starts

1. **Developer account entity** — individual (fast) vs. organization/LLC (needs D-U-N-S,
   looks right for universities/incubators). Affects both stores' public seller name.
2. **Billing posture** — confirm login-only at launch (recommended), or scope IAP now.
3. **Push notification copy** — the templates should go through the same sign-off as the
   frozen email copy before launch.
4. **Who holds signing keys / store accounts** — founder-owned, documented recovery.

# Soul Space — iOS App: Analysis & Requirements

*Prepared July 2026 · iOS-specific companion to `docs/mobile-apps-analysis.md`.
Every "current state" claim below was verified against the codebase at commit `ffb12f8`
and against live production (soulspacehealth.org).*

---

## 1. Executive summary

Soul Space's backend does not move into an iOS app. The safety pipeline (Haiku classifier →
Claude Mirror), AES-256-GCM encryption, Stripe billing, and analytics all stay server-side.
The iOS app is a **client** for the same API.

The chosen route is **Capacitor with remote content** (`server.url` → production). The web UI
is reused as-is; native capability is added via plugins. This is already scaffolded —
`capacitor.config.ts` exists with the bundle ID and remote-content strategy committed.

**The honest position: this is roughly 60% a paperwork-and-policy project and 40% engineering.**
The two largest risks are Apple's 4.2 "minimum functionality" rejection and the subscription /
In-App-Purchase question. Neither is solved by writing code.

**Hard blocker to name first: iOS builds require macOS + Xcode. The current development
machine is Windows 11.** No amount of configuration changes this — Apple's toolchain is
macOS-only. This must be resolved before any iOS work starts (§3.1).

---

## 2. Current state — verified

### Already done ✓

| Item | Evidence |
|---|---|
| PWA baseline (Phase 0) shipped | `/manifest.webmanifest` → 200 `application/manifest+json`, `/sw.js` → 200, all icons → 200, verified live in production |
| Capacitor config committed | `capacitor.config.ts` — appId `org.soulspacehealth.app`, remote content, `allowNavigation` allowlist |
| Capacitor deps installed | `@capacitor/core` + `@capacitor/cli` v8.4.1 |
| Apple touch icon + iOS splash assets | `public/icons/apple-touch-icon.png`, `public/splash/*` (13 device sizes) |
| AASA served with correct MIME | `next.config.mjs` sets `Content-Type: application/json` on `/.well-known/apple-app-site-association` — Apple requires exactly this |
| Magic-link deep-link bridge | `src/app/auth/email/page.tsx` (`token_hash`) — the entry point Universal Links will target |
| Account deletion in-app | `/api/user/data` DELETE, wired into Settings — satisfies Apple Guideline 5.1.1(v) |
| Age gate enforced | `src/middleware.ts` gates `/session/*` on the `ss_age_ok` cookie |
| Crisis / 988 routing | Present across 8 files incl. `/crisis`, session reflection, offline page |
| Voice input degrades safely | `VoiceInput.tsx` feature-detects `SpeechRecognition`; hides itself where unsupported |

### Not done ✗

| Gap | Impact |
|---|---|
| **`ios/` platform never generated** | `npx cap add ios` has not been run. Requires macOS + Xcode. |
| **`apple-app-site-association` contains `TEAMID_PLACEHOLDER`** | Universal Links are **non-functional** until the real Apple Team ID replaces this. Emailed sign-in links will open Safari, not the app. |
| **Zero Capacitor plugins installed** | No push, biometrics, haptics, splash, or app-state plugins. These are precisely the native features that mitigate Apple 4.2. |
| No Apple Developer account (assumed) | $99/yr; gates everything downstream including the Team ID above |
| No APNs key, no push infrastructure | Needs a `device_tokens` table + send hook |
| No App Store metadata, screenshots, or review-notes package | Required at submission |

---

## 3. Requirements

### 3.1 Build environment — resolve first

| # | Requirement | Notes |
|---|---|---|
| E1 | **A Mac** (Apple Silicon preferred) running current macOS | Non-negotiable for iOS. Options: buy/borrow a Mac; rent a cloud Mac (MacStadium, Scaleway); or use a macOS CI (Codemagic, Ionic Appflow, GitHub Actions `macos-latest`). CI-only is workable for builds but painful for first-time setup and debugging — budget for real Mac access at least initially. |
| E2 | Xcode (current release) + Command Line Tools | Free; large download |
| E3 | CocoaPods | Capacitor iOS dependency manager |
| E4 | Node 20+ toolchain on the Mac | To run `npx cap add ios` / `npx cap sync` |

### 3.2 Apple accounts & identifiers

| # | Requirement | Cost / lead time |
|---|---|---|
| A1 | **Apple Developer Program enrollment** | $99/yr. Individual = fast (~24–48h). **Organization = requires a D-U-N-S number (days–weeks)** and shows a company seller name — materially better for university/accelerator credibility. **Decide the entity now**; changing later is painful. |
| A2 | **Apple Team ID** | Issued with A1. Immediately unblocks the AASA placeholder. |
| A3 | Bundle ID registered: `org.soulspacehealth.app` | Must match `capacitor.config.ts` exactly |
| A4 | App Store Connect app record | Created after A1 |
| A5 | Signing: Distribution certificate + provisioning profiles | Prefer Xcode-managed signing; document key custody and recovery |
| A6 | APNs Auth Key (`.p8`) | For push; one key covers all apps on the team |

### 3.3 Apple review compliance — the real gates

| # | Requirement | Guideline | Status / action |
|---|---|---|---|
| R1 | **Ship genuine native functionality** — not a bare web wrapper | **4.2 Minimum Functionality** | ⚠️ Highest rejection risk. Mitigation = the four native features in §3.4. Lead the review notes with them. |
| R2 | **Subscription posture** | **3.1.1 In-App Purchase** | Recommend **login-only at launch**: the iOS app must not sell, link to, or mention the price of Essentials/Insights. Free tier fully functional; paid features light up for users who subscribed on the web. (Netflix/Kindle model — long-standing and compliant.) Adopting IAP later costs 15% under the Small Business Program plus entitlement-reconciliation work against Stripe. |
| R3 | **Not medical / not therapy positioning** | 1.4.1 | Strong position already — the frozen product copy ("non-clinical, non-diagnostic, not a crisis service") is exactly what Apple wants stated. Repeat it verbatim in the App Store description. |
| R4 | **Crisis / self-harm handling documented** | 1.4.1 | The hard-coded safety gate (classifier before every Mirror, Season suppression, 988 routing) is an asset. Walk the reviewer through it explicitly. |
| R5 | **Account deletion in-app** | 5.1.1(v) | ✓ Already implemented |
| R6 | **App Privacy questionnaire ("nutrition labels")** | 5.1.2 | Genuinely strong: no third-party trackers, no ads, AES-256-GCM content encryption, self-hosted analytics. Answer honestly — this is a differentiator. |
| R7 | **Encryption export compliance** | — | Standard HTTPS/AES → exempt. Set `ITSAppUsesNonExemptEncryption = NO` in Info.plist. (Separate annual French declaration if distributed in France.) |
| R8 | **Age rating** | — | Rate 17+ / Mature Themes. Keep the in-app age gate; do not remove it in favour of the store rating. |
| R9 | **Demo account for review** | 2.1 | Seed one account with a completed session. Reviewers of wellness apps consistently need this. |
| R10 | Privacy policy URL reachable | 5.1.1 | ✓ `/privacy` exists; add app-specific data-collection lines |

### 3.4 Native features required to clear Guideline 4.2

These are not nice-to-haves — they are the 4.2 mitigation. Ordered by review visibility per effort.

| # | Feature | Plugin | Effort | Why it matters |
|---|---|---|---|---|
| N1 | **Biometric app-lock** (Face ID before the space opens) | `capacitor-native-biometric` | ~1 day | Best value on the list. Perfect thematic fit for a privacy-first emotional product, and visibly native. Ship as a setting, default off. Requires `NSFaceIDUsageDescription` in Info.plist. |
| N2 | **Push notifications** | `@capacitor/push-notifications` + APNs | ~3–5 days | The mobile sibling of lifecycle emails. Needs a `device_tokens` table and a send hook in the existing digest cron — the scheduling/cooldown logic already exists. **Copy must clear the same review bar as the frozen email copy** (no "we miss you", no streaks). |
| N3 | **Native splash + full-screen launch** | `@capacitor/splash-screen` | ~0.5 day | Assets already exist from Phase 0 |
| N4 | **Haptics** on resonance tap / season reveal | `@capacitor/haptics` | ~0.5 day | Cheap, and makes the app feel native rather than wrapped |
| N5 | **Designed offline state** | existing `/offline` + `@capacitor/network` | ~0.5 day | Page already exists; wire native network detection |
| N6 | **Universal Links** registered for `/auth/*` | AASA + Associated Domains entitlement | ~1 day | Emailed sign-in CTA opens the *app*, already authenticated. Fallback custom scheme `soulspace://`. |

### 3.5 Configuration changes required

| # | Change | File |
|---|---|---|
| C1 | Replace `TEAMID_PLACEHOLDER` with the real Team ID | `public/.well-known/apple-app-site-association` |
| C2 | Add Associated Domains entitlement (`applinks:soulspacehealth.org`) | Xcode project |
| C3 | Add `NSFaceIDUsageDescription` (and mic/speech strings only if native voice is added later) | `ios/App/App/Info.plist` |
| C4 | Set `ITSAppUsesNonExemptEncryption = NO` | `ios/App/App/Info.plist` |
| C5 | Verify `allowNavigation` covers every host the app must keep in-shell | `capacitor.config.ts` |
| C6 | Confirm CSP `connect-src` permits APNs-related and Supabase hosts from the WebView origin | `next.config.mjs` |

### 3.6 Store assets & metadata

| # | Item | Notes |
|---|---|---|
| S1 | 1024×1024 App Store icon (no alpha, no rounded corners) | From existing Phase 0 master |
| S2 | Screenshots at Apple's currently required device sizes | **Verify the exact required set in App Store Connect at submission time — Apple changes these.** Produce from the live product at real device widths. |
| S3 | App name, subtitle, keywords, description | Description must carry the non-clinical scope statement (R3) |
| S4 | Support URL + marketing URL | `/contact` and root |
| S5 | Review notes package | Demo credentials, safety-pipeline explanation, crisis-flow walkthrough, privacy summary, and a lead paragraph on the native features (R1) |

### 3.7 iOS-specific QA matrix

WKWebView behaves differently from Safari. These are the cases that actually break.

| # | Test | Why |
|---|---|---|
| Q1 | **`tel:988` hands off to the dialer from inside WKWebView** | **Safety-critical.** Must be verified on a real device, not the simulator. |
| Q2 | Supabase auth session persists across app cold starts | WKWebView cookie/localStorage persistence differs from Safari; a silent logout loop is the classic hybrid-app bug |
| Q3 | Magic-link email opens the app (not Safari) from **Apple Mail and Gmail** | Gmail's in-app browser is the usual Universal-Links breaker — test both explicitly |
| Q4 | Voice input is absent, not broken | Feature detection already handles this; confirm no dead UI |
| Q5 | Safe-area insets (notch / Dynamic Island / home indicator) | `contentInset: 'automatic'` is set; verify on a notched device |
| Q6 | Age gate cannot be bypassed in the shell | Middleware enforces it; confirm no WebView navigation path skips it |
| Q7 | External links (988 explainers, privacy) open the system browser | Per `allowNavigation` allowlist |
| Q8 | Offline behaviour shows the designed state, not a WebKit error page | |
| Q9 | No pricing/purchase surface visible anywhere in the iOS build | Enforces the R2 login-only posture |

---

## 4. Sequence & realistic timeline

Assumes Mac access is resolved (E1) before day 1.

| Stage | Work | Duration |
|---|---|---|
| 0 | Apple Developer enrollment (**start immediately** — org entity adds weeks) | 1 day–3 weeks |
| 1 | `npx cap add ios`, first device build, signing | 2–3 days |
| 2 | Native features N1–N6 | 1–2 weeks |
| 3 | Backend for push (`device_tokens`, send hook, copy sign-off) | 3–5 days |
| 4 | QA matrix §3.7 on real devices | 3–5 days |
| 5 | Store metadata, screenshots, review notes | 2–3 days |
| 6 | TestFlight beta | 3–7 days |
| 7 | App Review — **assume one rejection and resubmit** | 1–3 weeks |

**Realistic "live on the App Store": 5–8 weeks from a standing start**, dominated by
enrollment lead time and review cycles rather than engineering.

> **Do not promise a store date to Mission College or SkyDeck.** The PWA is installable
> today and is entirely sufficient for a pilot; store presence buys credibility and
> distribution, not capability. Committing to a date that depends on Apple's review queue
> is the kind of thing that damages an institutional relationship.

---

## 5. Decisions needed before work starts

1. **Mac access** — purchase, borrow, or cloud CI? Blocks everything. (E1)
2. **Developer account entity** — individual (fast) vs organization (D-U-N-S, weeks, better
   seller name for universities and accelerators). Affects the public App Store listing.
3. **Billing posture** — confirm login-only at launch, or scope IAP now (15% + Stripe
   entitlement reconciliation).
4. **Push notification copy** — must go through the same sign-off as the frozen email copy
   before any template ships.
5. **Key custody** — who holds the signing certificate, APNs key, and App Store Connect
   account, and what is the documented recovery path?

---

## 6. Recommendation

Do **not** start the iOS build this week. The Friday demo and the SkyDeck application are
better served by the PWA, which is live, installable, and verified working today.

The one genuinely urgent iOS-adjacent item is **Apple Developer Program enrollment** — if the
organization route is chosen, the D-U-N-S lead time is the longest pole in the whole project
and costs nothing to start now.

Fix the install-discovery gap in the PWA first (the "Add to Home Screen" hint is currently
suppressed on `/age-gate`, which is where most first-time mobile visitors land — see
`HIDE_ON` in `src/components/ui/InstallPrompt.tsx`). That is a hours-long fix that directly
addresses "I couldn't download it like an app," and it improves the demo this week rather
than in two months.

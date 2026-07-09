# Mobile Build Runbook — Phase 1 (Capacitor shells)

*Companion to `docs/mobile-apps-analysis.md`. Everything testable without the
platform SDKs is already in the repo (see "Already done"). This runbook is the
exact sequence for the machine(s) with Android Studio and Xcode, plus the
store-side steps only a founder can do.*

---

## Already done (in this repo — nothing to repeat)

- ✅ **PWA baseline**: `src/app/manifest.ts`, icon set in `public/icons/`
  (192/512 + maskable + apple-touch), service worker `public/sw.js`
  (offline fallback + static-asset cache, never touches `/api/*`),
  `/offline` page, iOS home-screen metadata in `layout.tsx`
- ✅ **Capacitor config**: `capacitor.config.ts` — remote-content shell
  pointed at production, app id `org.soulspacehealth.app`
- ✅ **Deep-link groundwork**: `public/.well-known/apple-app-site-association`
  and `assetlinks.json` (with placeholders — see step 3), served with the
  correct content type via `next.config.mjs`
- ✅ **Auth bridge**: `/auth/email?token_hash=…` signs a user in from an email
  CTA — Universal/App Links pointed at `/auth/*` make those CTAs open the app

## Prerequisites (founder actions — start these first, they gate everything)

1. **Apple Developer Program** ($99/yr). Organization enrollment needs a
   D-U-N-S number. Note your **Team ID** (Membership page).
2. **Google Play Console** ($25 once). ⚠ New individual accounts must run a
   **closed test with ≥12 testers for 14 continuous days** before production
   release is unlocked. Create the account and start this clock immediately.
3. A Mac with Xcode 15+ (iOS build is impossible on Windows). Android Studio
   on any OS.

## Build sequence (dev machine with SDKs)

```bash
# 1. Generate native projects (commit both directories afterward)
npx cap add android
npx cap add ios

# 2. Native plugins for the Phase-1 feature set
npm i @capacitor/push-notifications @capacitor/haptics @capacitor/app \
      @capacitor/splash-screen capacitor-native-biometric
npx cap sync

# 3. Deep links
#    - Replace TEAMID_PLACEHOLDER in public/.well-known/apple-app-site-association
#      with the real Team ID; redeploy the site BEFORE App Store review.
#    - Android: after generating the upload key (or enrolling in Play App
#      Signing), paste the SHA-256 fingerprint into public/.well-known/assetlinks.json.
#    - iOS: add Associated Domains capability: applinks:soulspacehealth.org
#    - Android: intent-filter for https://soulspacehealth.org with autoVerify=true
#      (paths /auth/*, /session/*, /dashboard) in AndroidManifest.xml

# 4. Icons & splash from the existing assets
npm i -D @capacitor/assets
npx capacitor-assets generate --iconBackgroundColor '#060E18' \
    --splashBackgroundColor '#060E18'

# 5. Open, build, run on devices
npx cap open android   # Android Studio → run on device/emulator
npx cap open ios       # Xcode → run on device/simulator
```

## Native feature wiring (small, self-contained tasks)

| Feature | Plugin | Notes |
|---|---|---|
| Push notifications | `@capacitor/push-notifications` | Register token → POST to a new `/api/devices` endpoint (table: `device_tokens(user_id, token, platform)`); send from the existing digest cron via FCM/APNs. Copy needs the same sign-off as frozen email copy. |
| Biometric app-lock | `capacitor-native-biometric` | Gate on app resume; Settings toggle, default off. |
| Haptics | `@capacitor/haptics` | Light impact on resonance tap + season reveal only. |
| Splash | `@capacitor/splash-screen` | Ink background, ring mark, no animation. |

## Device QA checklist (safety-critical items first)

- [ ] `tel:988` and SMS links hand off to the dialer/messages from the WebView (both platforms)
- [ ] Crisis page renders and is reachable when offline (service worker fallback shows the 988 line)
- [ ] Magic-link email opened in Gmail/Apple Mail opens the **app** (not browser) and lands signed in
- [ ] Voice input button correctly hidden (SpeechRecognition unavailable in WebViews)
- [ ] Session flow end-to-end on a physical small phone (375×812 class)
- [ ] No pricing/purchase links visible in the iOS build (login-only billing posture)
- [ ] Account deletion reachable in-app (Settings)
- [ ] Offline → airplane mode mid-session → calm fallback, no data loss on return

## Store submission

**Both stores:** privacy policy URL (`/privacy`), data-safety/privacy-labels
forms (truthful strengths: no 3rd-party trackers, AES-256-GCM content
encryption, self-hosted analytics), age rating 17+/Teen+, demo account with a
seeded session, review notes leading with: not-therapy scope statement, the
Haiku safety classifier + crisis gate, and the native features (push,
biometric lock, haptics, offline).

**Apple specifics:** `ITSAppUsesNonExemptEncryption = NO` in Info.plist;
Associated Domains entitlement; expect one 4.2-minimum-functionality
conversation — respond with the native feature list.

**Google specifics:** Play App Signing on; the 14-day closed test must be
complete; target API level per current Play policy (Capacitor default is
compliant).

## Explicitly out of scope for Phase 1

- In-app purchases (login-only posture at launch — see analysis §4.1)
- Native speech-to-text plugin for voice input (post-launch, paid-tier ask)
- React Native rebuild (Phase 2, gated on store traction)

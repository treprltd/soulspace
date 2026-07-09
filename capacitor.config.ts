import type { CapacitorConfig } from '@capacitor/cli'

// Soul Space native shells (Phase 1 of docs/mobile-apps-analysis.md).
//
// Remote-content strategy: the shells load the live production site, so every
// web deploy reaches the apps instantly with no store re-review. Only native
// binary changes (plugins, icons, splash) require resubmission.
//
// The native projects are generated on a machine with the platform SDKs:
//   npx cap add android   (Android Studio required to build)
//   npx cap add ios       (macOS + Xcode required)
// See docs/mobile-build-runbook.md for the full sequence.
const config: CapacitorConfig = {
  appId: 'org.soulspacehealth.app',
  appName: 'Soul Space',
  // webDir is required by the CLI but unused in remote mode — public/ stands in.
  webDir: 'public',
  server: {
    url: 'https://soulspacehealth.org',
    // Keep every navigation inside the shell for our own hosts; external links
    // (988, privacy explainers) open the system browser via the OS default.
    allowNavigation: ['soulspacehealth.org', '*.soulspacehealth.org', '*.supabase.co'],
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#060E18',
  },
  android: {
    backgroundColor: '#060E18',
  },
}

export default config

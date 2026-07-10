import type { MetadataRoute } from 'next'

// Web app manifest — makes Soul Space installable on Android/iOS home screens
// and provides the identity/assets the Capacitor store shells reuse.
// Served automatically by the App Router at /manifest.webmanifest.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Soul Space',
    short_name: 'Soul Space',
    description:
      'A private, guided space for emotional reflection — the structured pause between what you feel and what you decide to do next. Non-clinical, non-diagnostic, not a crisis service.',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    // Intentionally NOT orientation-locked: phones run portrait naturally, and
    // tablets (iPad, Android tablets) must be usable in landscape. The layout is
    // responsive and centered, so both orientations read well.
    display_override: ['standalone', 'minimal-ui'],
    background_color: '#060E18',
    theme_color: '#060E18',
    categories: ['lifestyle', 'health'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-192-maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    // Long-press app-icon shortcuts (Android / desktop). Both land inside scope.
    shortcuts: [
      {
        name: 'Begin a reflection',
        short_name: 'Reflect',
        url: '/age-gate',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Your dashboard',
        short_name: 'Dashboard',
        url: '/dashboard',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
    // Screenshots enable the richer install dialog (side-by-side preview) on
    // Android/Chromium. `narrow` = phone, `wide` = tablet/desktop.
    // form_factor/label are valid per the Web App Manifest spec but not yet in
    // Next 14's Manifest type, so we cast past the lagging type definition.
    screenshots: [
      {
        src: '/screenshots/mobile-home.png',
        sizes: '1080x2280',
        type: 'image/png',
        form_factor: 'narrow',
        label: 'Soul Space on mobile',
      },
      {
        src: '/screenshots/tablet-home.png',
        sizes: '2048x1536',
        type: 'image/png',
        form_factor: 'wide',
        label: 'Soul Space on tablet',
      },
    ] as unknown as MetadataRoute.Manifest['screenshots'],
  }
}

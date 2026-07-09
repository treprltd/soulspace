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
    orientation: 'portrait',
    background_color: '#060E18',
    theme_color: '#060E18',
    categories: ['lifestyle', 'health'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-192-maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}

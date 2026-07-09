/* Soul Space service worker — deliberately minimal.
 *
 * Scope of responsibility:
 *   1. Precache the offline fallback page + app icons.
 *   2. Navigations: network-first; when the network is unreachable, serve /offline.
 *   3. Hashed static assets (/_next/static/, /icons/): cache-first (immutable).
 *
 * Explicitly NOT cached: /api/* (sessions, Mirror, auth — always live),
 * non-GET requests, and cross-origin requests. A stale emotional-reflection
 * response would be worse than no response.
 */

const VERSION = 'soulspace-sw-v1'
const PRECACHE = [
  '/offline',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return

  // Page navigations — network first, offline fallback
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match('/offline').then((cached) => cached ?? Response.error())
      )
    )
    return
  }

  // Immutable static assets — cache first
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ??
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(VERSION).then((cache) => cache.put(req, copy))
            }
            return res
          })
      )
    )
  }
})

// This file is loaded in the browser. It must not reference server-only modules.
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Capture 100 % of transactions in production; lower in dev to reduce noise.
  tracesSampleRate: process.env.NEXT_PUBLIC_ENV === 'production' ? 0.2 : 0,

  // Replay 5 % of sessions; 100 % of sessions with an error.
  replaysSessionSampleRate: 0.05,
  replaysOnErrorSampleRate: 1.0,

  // Never send events in local development — too noisy.
  enabled: process.env.NEXT_PUBLIC_ENV !== 'local',

  // ── Third-party / browser-extension noise ────────────────────────────────
  // Our global onunhandledrejection handler captures EVERY unhandled rejection
  // on the page, including ones thrown by extension-injected content scripts
  // (password managers, content blockers, etc.) that our code never ran. These
  // are not Soul Space bugs — drop them before ingest so they don't alert.
  // `runtime.sendMessage` / "Tab not found" is a WebExtension API our app never
  // calls; the app doesn't reference chrome.*/browser.runtime anywhere.
  ignoreErrors: [
    'runtime.sendMessage',
    'Extension context invalidated',
    'chrome-extension://',
    'safari-extension://',
    'safari-web-extension://',
    'moz-extension://',
    // Benign browser-internal noise
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
  ],
  // Drop any event whose stack originates in an extension. Safari masks
  // extension script URLs as webkit-masked-url://, so include that too.
  denyUrls: [
    /^chrome-extension:\/\//i,
    /^moz-extension:\/\//i,
    /^safari-extension:\/\//i,
    /^safari-web-extension:\/\//i,
    /^webkit-masked-url:\/\//i,
  ],

  // Strip PII from breadcrumbs automatically.
  beforeSend(event) {
    // Never forward session text or email addresses to Sentry.
    if (event.request?.data) {
      event.request.data = '[redacted]'
    }
    return event
  },

  integrations: [
    Sentry.replayIntegration({
      // Mask all text and block all media to prevent session content leaking.
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
})

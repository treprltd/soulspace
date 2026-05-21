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

// This file is loaded in the Node.js SSR / API route runtime.
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: process.env.NEXT_PUBLIC_ENV === 'production' ? 0.2 : 0,

  enabled: process.env.NEXT_PUBLIC_ENV !== 'local',

  beforeSend(event) {
    // Scrub any server-side request bodies — they may contain session text.
    if (event.request?.data) {
      event.request.data = '[redacted]'
    }
    // Never leak API keys in extra / contexts.
    if (event.extra) {
      delete event.extra['ANTHROPIC_API_KEY']
      delete event.extra['ENCRYPTION_KEY']
      delete event.extra['SUPABASE_SERVICE_ROLE_KEY']
    }
    return event
  },
})

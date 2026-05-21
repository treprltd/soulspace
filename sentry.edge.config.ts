// This file is loaded in the Edge runtime (middleware).
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NEXT_PUBLIC_ENV === 'production' ? 0.2 : 0,
  enabled: process.env.NEXT_PUBLIC_ENV !== 'local',
})

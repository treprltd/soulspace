// Next.js instrumentation hook — the ONLY place the server/edge Sentry SDK
// initializes. Since @sentry/nextjs v8, sentry.server.config.ts and
// sentry.edge.config.ts are no longer auto-loaded; without this register()
// they are dead files and no server-side errors reach Sentry.
// (sentry.client.config.ts is still injected into the browser bundle by
// withSentryConfig and does not go through this hook on Next 14.)
import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config')
  }
}

// Reports errors from nested React Server Components. Inert on Next 14
// (the hook fires from Next 15) — wired up now so the future 15.x upgrade
// gets it for free.
export const onRequestError = Sentry.captureRequestError

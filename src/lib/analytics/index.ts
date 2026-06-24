import type { EventName } from '@/types'
import { createClient } from '@/lib/supabase/client'

interface LogEventInput {
  sessionId?: string
  eventName: EventName
  properties?: Record<string, unknown>
}

// Client-side funnel event logger. user_hash is derived server-side from the
// Bearer token (see /api/events) — never computed or trusted client-side.
export async function logEvent({ sessionId, eventName, properties }: LogEventInput): Promise<void> {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`

    await fetch('/api/events', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        session_id: sessionId,
        event_name: eventName,
        properties: properties ?? {},
      }),
    })
  } catch {
    // Non-fatal — analytics must never break the user flow
  }
}

export function createEventLogger(sessionId?: string) {
  return (eventName: EventName, properties?: Record<string, unknown>) =>
    logEvent({ sessionId, eventName, properties })
}

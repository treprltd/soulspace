import { EventName, EventPayload } from '@/types'
import crypto from 'crypto'

export function hashUserId(userId: string): string {
  return crypto.createHash('sha256').update(userId).digest('hex').slice(0, 16)
}

export async function logEvent(
  payload: EventPayload & { userId?: string }
): Promise<void> {
  try {
    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: payload.sessionId,
        event_name: payload.eventName,
        user_hash: payload.userId ? hashUserId(payload.userId) : undefined,
        properties: payload.properties ?? {},
      }),
    })
  } catch {
    // Non-fatal — analytics must never break the user flow
  }
}

export function createEventLogger(sessionId: string, userId?: string) {
  return (eventName: EventName, properties?: Record<string, unknown>) =>
    logEvent({ sessionId, eventName, userId, properties })
}

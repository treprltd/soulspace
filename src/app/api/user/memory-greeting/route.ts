import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/getAuthUser'
import { decrypt } from '@/lib/encryption'
import { classifyReturnGap, memoryGreeting } from '@/lib/copy/memory'

const SEASON_NAMES: Record<string, string> = {
  W: 'Winter', Sp: 'Spring', Su: 'Summer', Au: 'Autumn',
}

// ── GET /api/user/memory-greeting ─────────────────────────────────────────────
// Returns the "welcome back" memory greeting for the authenticated user, or
// null when there's nothing to greet with (first-time visitor, or every prior
// session was safety-flagged — the crisis gate extends to memory).
//
// This is intentionally server-side: encrypted_memory_note must be decrypted
// with the server-only key, and the crisis gate (never surface memory from a
// safety-flagged session) must be enforced before any text reaches the client.
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const user = await getAuthUser(req, supabase)
    if (!user) return NextResponse.json({ greeting: null })

    const db = createServiceClient()

    // Most recent COMPLETED, non-safety-flagged session that produced a mirror
    // (season_assigned IS NOT NULL) — the only kind eligible to seed memory.
    const { data: sessions } = await db
      .from('sessions')
      .select('id, created_at, season_assigned, safety_flagged')
      .eq('user_id', user.id)
      .eq('safety_flagged', false)
      .not('season_assigned', 'is', null)
      .order('created_at', { ascending: false })
      .limit(2)

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ greeting: null })
    }

    // "Returning user" requires at least two prior sessions — a single session
    // is the person's first visit; there is nothing to "remember back" yet.
    if (sessions.length < 2) {
      return NextResponse.json({ greeting: null })
    }

    const lastSession = sessions[0]
    const daysSince = Math.floor(
      (Date.now() - new Date(lastSession.created_at).getTime()) / (1000 * 60 * 60 * 24)
    )
    const gap = classifyReturnGap(daysSince)

    let memoryNote: string | null = null
    const { data: content } = await db
      .from('session_content')
      .select('encrypted_memory_note')
      .eq('session_id', lastSession.id)
      .maybeSingle()

    if (content?.encrypted_memory_note) {
      try {
        memoryNote = decrypt(content.encrypted_memory_note)
      } catch {
        memoryNote = null // never let a decrypt failure surface or break the page
      }
    }

    const seasonName = lastSession.season_assigned ? SEASON_NAMES[lastSession.season_assigned] ?? null : null
    const greeting = memoryGreeting(gap, memoryNote, seasonName)

    return NextResponse.json({ greeting })
  } catch {
    // Memory is an enhancement, never a blocker — fail closed and silent.
    return NextResponse.json({ greeting: null })
  }
}

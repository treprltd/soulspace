import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/getAuthUser'
import { decrypt } from '@/lib/encryption'

// ── GET /api/sessions/[id] ────────────────────────────────────────────────────
// Returns full session detail including decrypted context text and mirror output.
// Only accessible by the session owner.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params
    const supabase = await createClient()
    const user = await getAuthUser(req, supabase)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()

    // Verify the session belongs to this user
    const { data: session, error: sessionErr } = await service
      .from('sessions')
      .select('id, branch, created_at, completed_at, season_assigned, resonance_tap, intensity, safety_flagged')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (sessionErr || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Fetch encrypted content (may not exist for incomplete sessions)
    const { data: content } = await service
      .from('session_content')
      .select('encrypted_context, encrypted_mirror_output')
      .eq('session_id', id)
      .maybeSingle()

    let contextText: string | null = null
    let mirrorOutput: string | null = null

    if (content) {
      try {
        if (content.encrypted_context) contextText = decrypt(content.encrypted_context)
      } catch { /* decryption error — omit field */ }
      try {
        if (content.encrypted_mirror_output) mirrorOutput = decrypt(content.encrypted_mirror_output)
      } catch { /* decryption error — omit field */ }
    }

    return NextResponse.json({
      ...session,
      contextText,
      mirrorOutput,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

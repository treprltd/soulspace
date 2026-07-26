import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/getAuthUser'
import { decrypt } from '@/lib/encryption'
import { sendEmail, accountDeletionEmail } from '@/lib/email'

// Self-service data export — GDPR Art. 15 (access) + Art. 20 (portability),
// CCPA/CPRA right to know (compliance finding #6). Returns the authenticated
// user's OWN data as a downloadable JSON, replacing the previous manual
// privacy@ email process. Mirrors the DELETE handler's auth + service-role
// pattern. Session content is decrypted here because it is the user's own data
// being returned to the user — the exact case the encryption protects for
// everyone else.
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const user = await getAuthUser(req, supabase)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const service = createServiceClient()

    const { data: profile } = await service
      .from('users').select('*').eq('id', user.id).single()

    const { data: sessions } = await service
      .from('sessions').select('*').eq('user_id', user.id)
      .order('created_at', { ascending: true })

    const sessionIds = (sessions ?? []).map(s => s.id)

    // Decrypt each content row for the export; never let one bad row abort it.
    const decode = (c: string | null): string | null => {
      if (!c) return null
      try { return decrypt(c) } catch { return '[unable to decrypt]' }
    }
    let sessionContent: Array<Record<string, unknown>> = []
    if (sessionIds.length > 0) {
      const { data: rows } = await service
        .from('session_content')
        .select('session_id, encrypted_context, encrypted_mirror_output, created_at')
        .in('session_id', sessionIds)
      sessionContent = (rows ?? []).map(r => {
        const mirror = decode(r.encrypted_mirror_output)
        let mirrorParsed: unknown = mirror
        if (mirror && mirror !== '[unable to decrypt]') {
          try { mirrorParsed = JSON.parse(mirror) } catch { /* keep raw */ }
        }
        return {
          session_id:    r.session_id,
          context:       decode(r.encrypted_context),
          mirror_output: mirrorParsed,
          created_at:    r.created_at,
        }
      })
    }

    const payload = {
      export_generated_at: new Date().toISOString(),
      account:  profile ?? { id: user.id, email: user.email },
      sessions: sessions ?? [],
      session_content: sessionContent,
      notice: 'Complete export of your Soul Space data. Session content has been decrypted for you.',
    }

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'Content-Type':        'application/json',
        'Content-Disposition': `attachment; filename="soul-space-data-export-${new Date().toISOString().slice(0, 10)}.json"`,
        'Cache-Control':       'no-store',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Permanent data deletion — CPRA compliant
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const user = await getAuthUser(req, supabase)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Capture email before deletion so we can still send the confirmation
    const userEmail = user.email ?? ''

    // Use service role to bypass RLS for complete deletion
    const service = createServiceClient()

    // Delete all sessions (cascades to session_content, events, safety_events via FK)
    const { error: sessionsError } = await service
      .from('sessions')
      .delete()
      .eq('user_id', user.id)

    if (sessionsError) throw sessionsError

    // Delete user row
    const { error: userError } = await service
      .from('users')
      .delete()
      .eq('id', user.id)

    if (userError) throw userError

    // Sign out
    await supabase.auth.signOut()

    // Send deletion confirmation email (best-effort — data already gone)
    if (userEmail) {
      try {
        const template = accountDeletionEmail()
        await sendEmail({ to: userEmail, ...template })
      } catch (emailErr) {
        console.error('Account deletion email failed (non-fatal):', emailErr)
      }
    }

    return NextResponse.json({ ok: true, message: 'All data permanently deleted.' })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

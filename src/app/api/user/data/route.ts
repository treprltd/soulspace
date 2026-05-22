import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/getAuthUser'
import { sendEmail, accountDeletionEmail } from '@/lib/email'

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

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/getAuthUser'
import { sendEmail, welcomeEmail } from '@/lib/email'

// Called client-side after the very first sign-in (new account).
// Idempotent — checks welcome_email_sent_at column (set at first send).
// This prevents re-sending to returning users who clear storage or use a new device.
// NOTE: Does NOT use session count — that check is unreliable when a user tries the
//       app anonymously before registering (session recovery creates a row before
//       this endpoint fires, making the user look non-new).
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const user = await getAuthUser(req, supabase)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const service = createServiceClient()

    // Only send if welcome_email_sent_at is null (email never sent before)
    const { data: userRow } = await service
      .from('users')
      .select('welcome_email_sent_at')
      .eq('id', user.id)
      .single()

    if (userRow?.welcome_email_sent_at) {
      // Already sent — idempotency guard
      return NextResponse.json({ skipped: true, reason: 'already_sent' })
    }

    const email = user.email ?? ''
    if (!email) {
      return NextResponse.json({ skipped: true, reason: 'no_email' })
    }

    const template = welcomeEmail()
    await sendEmail({ to: email, ...template })

    // Mark as sent — prevents duplicate sends on future sign-ins
    await service
      .from('users')
      .update({ welcome_email_sent_at: new Date().toISOString() })
      .eq('id', user.id)

    return NextResponse.json({ sent: true })
  } catch (err) {
    // Non-fatal — welcome email failure should never break the auth flow
    const detail = err instanceof Error ? err.message : String(err)
    console.error('Welcome email error (non-fatal):', detail)
    return NextResponse.json({ skipped: true, reason: 'error', detail })
  }
}

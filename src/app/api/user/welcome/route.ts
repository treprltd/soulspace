import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/getAuthUser'
import { sendEmail, welcomeEmail } from '@/lib/email'

// Called client-side after the very first sign-in (new account).
// Idempotent — checks that the user has 0 sessions before sending.
// This prevents re-sending the welcome email to returning users who
// clear their browser storage or sign in from a new device.
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const user = await getAuthUser(req, supabase)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const service = createServiceClient()

    // Only send if this user has no sessions yet (true new user)
    const { count } = await service
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if ((count ?? 0) > 0) {
      // Returning user — not their first sign-in
      return NextResponse.json({ skipped: true, reason: 'not_new_user' })
    }

    const email = user.email ?? ''
    if (!email) {
      return NextResponse.json({ skipped: true, reason: 'no_email' })
    }

    const template = welcomeEmail()
    await sendEmail({ to: email, ...template })

    return NextResponse.json({ sent: true })
  } catch (err) {
    // Non-fatal — welcome email failure should never break the auth flow
    const detail = err instanceof Error ? err.message : String(err)
    console.error('Welcome email error (non-fatal):', detail)
    return NextResponse.json({ skipped: true, reason: 'error', detail })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// ── GET /api/user/profile/check-phone?phone=... ───────────────────────────────
// Public endpoint — returns { available: boolean }.
// Used by the registration form to check phone uniqueness before sending magic link.
export async function GET(req: NextRequest) {
  const phone = req.nextUrl.searchParams.get('phone')?.trim()
  if (!phone) return NextResponse.json({ error: 'phone parameter is required' }, { status: 400 })

  const digitsOnly = phone.replace(/\D/g, '')
  if (digitsOnly.length < 7 || digitsOnly.length > 15) {
    return NextResponse.json({ error: 'invalid phone number format' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data } = await service
    .from('users')
    .select('id')
    .eq('phone', phone)
    .maybeSingle()

  return NextResponse.json({ available: !data })
}

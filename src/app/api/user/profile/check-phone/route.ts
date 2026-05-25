import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// ── GET /api/user/profile/check-phone?phone=... ───────────────────────────────
// Public endpoint — returns { available: boolean }.
// Used by the registration form to check phone uniqueness before sending magic link.
export async function GET(req: NextRequest) {
  const phone = req.nextUrl.searchParams.get('phone')?.trim()
  if (!phone) return NextResponse.json({ available: true })

  const digitsOnly = phone.replace(/\D/g, '')
  if (digitsOnly.length < 7) return NextResponse.json({ available: true })

  const service = createServiceClient()
  const { data } = await service
    .from('users')
    .select('id')
    .eq('phone', phone)
    .maybeSingle()

  return NextResponse.json({ available: !data })
}

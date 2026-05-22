import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/getAuthUser'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const supabase = await createClient()
    // Accept both Bearer token (implicit flow) and cookie-based auth
    const user = await getAuthUser(req, supabase)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Service client — user verified above; cookie client has no JWT for
    // implicit-flow users so auth.uid() would be null → RLS violation
    const { error } = await createServiceClient()
      .from('sessions')
      .update({ completed_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/getAuthUser'

const CreateSessionSchema = z.object({
  branch: z.enum(['A', 'B', 'C', 'D']),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { branch } = CreateSessionSchema.parse(body)

    const supabase = await createClient()
    // Accept both Bearer token (implicit flow) and cookie-based auth
    const user = await getAuthUser(req, supabase)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use service client for the insert — user identity has already been
    // verified by getAuthUser above. The cookie-based `supabase` client has
    // no auth context for implicit-flow (localStorage) users, so PostgREST
    // would see auth.uid()=null and the RLS policy would block the insert.
    const service = createServiceClient()
    const { data, error } = await service
      .from('sessions')
      .insert({ user_id: user.id, branch })
      .select('id, branch, created_at')
      .single()

    if (error) throw error

    return NextResponse.json({ session: data }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

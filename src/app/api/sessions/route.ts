import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
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

    const { data, error } = await supabase
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

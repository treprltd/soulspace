import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/admin/auth'
import { getAdminClientSafe, AdminEnv } from '@/lib/admin/db'
import { getDefaultAdminEnv } from '@/lib/admin/env'
import { sendEmail, contactReplyEmail } from '@/lib/email'

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const params = req.nextUrl.searchParams
  const env    = (params.get('env') ?? getDefaultAdminEnv()) as AdminEnv
  const page   = Math.max(1, parseInt(params.get('page') ?? '1', 10))
  const filter = params.get('filter') // 'unreplied' | '' (all)
  const search = params.get('q')      // email/name search
  const limit  = 40
  const offset = (page - 1) * limit

  const _result = getAdminClientSafe(env)
  if (!_result.ok) return NextResponse.json({ error: _result.error, not_configured: true }, { status: 503 })
  const { db } = _result

  let query = db
    .from('contact_submissions')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (filter === 'unreplied') query = query.eq('replied', false)
  if (search) query = query.or(`email.ilike.%${search}%,name.ilike.%${search}%`)

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Unreplied count for sidebar badge
  const { count: unreplied } = await db
    .from('contact_submissions')
    .select('*', { count: 'exact', head: true })
    .eq('replied', false)

  return NextResponse.json({
    submissions: data ?? [],
    total:       count ?? 0,
    unreplied:   unreplied ?? 0,
    page,
    pages: Math.ceil((count ?? 0) / limit),
  })
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json() as { id?: string; reply?: string; env?: AdminEnv }
  const { id, reply, env } = body

  if (!id || !reply?.trim() || !env) {
    return NextResponse.json({ error: 'id, reply, and env are required' }, { status: 400 })
  }

  const _result = getAdminClientSafe(env)
  if (!_result.ok) return NextResponse.json({ error: _result.error, not_configured: true }, { status: 503 })
  const { db } = _result

  const { data: sub, error: fetchErr } = await db
    .from('contact_submissions')
    .select('name, email, category')
    .eq('id', id)
    .single()

  if (fetchErr || !sub) {
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
  }

  try {
    const tmpl = contactReplyEmail({ name: sub.name, category: sub.category, replyBody: reply.trim() })
    await sendEmail({ to: sub.email, toName: sub.name, subject: tmpl.subject, htmlContent: tmpl.htmlContent, textContent: tmpl.textContent })
  } catch (err) {
    console.error('[admin/contact] reply email failed:', err)
    return NextResponse.json({ error: 'Failed to send reply email.' }, { status: 500 })
  }

  const { error: updateErr } = await db
    .from('contact_submissions')
    .update({ replied: true, reply_body: reply.trim(), replied_at: new Date().toISOString() })
    .eq('id', id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, contactNotificationEmail, contactAckEmail } from '@/lib/email'
import { createServiceClient } from '@/lib/supabase/server'

const VALID_CATEGORIES = [
  'General question',
  'Feedback',
  'Technical issue',
  'Privacy / data request',
  'Subscription',
  'Press or partnership',
  'Other',
] as const

const SUB_OPTIONS: Record<string, string[]> = {
  'Subscription':           ['Refund request', 'Upgrade plan', 'Downgrade plan', 'Cancellation help', 'Billing issue', 'Other subscription question'],
  'General question':       ['How Soul Space works', 'Pricing & plans', 'Privacy & security', 'Accessibility', 'Other'],
  'Feedback':               ['Session experience', 'Mirror accuracy', 'Feature request', 'General feedback'],
  'Technical issue':        ["Can't sign in", 'Session not loading', 'Mirror not responding', 'Something looks broken', 'Other'],
  'Privacy / data request': ['Download my data', 'Delete my account', 'Data correction', 'Cookie preferences', 'Other'],
  'Press or partnership':   ['Media inquiry', 'Partnership proposal', 'Research inquiry', 'Other'],
  'Other':                  [],
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const { name, email, category, subOption, message } = body as Record<string, unknown>

  if (typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 100)
    return NextResponse.json({ error: 'Please enter your name.' }, { status: 422 })

  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 422 })

  if (typeof category !== 'string' || !(VALID_CATEGORIES as readonly string[]).includes(category))
    return NextResponse.json({ error: 'Please select a category.' }, { status: 422 })

  const validSubOptions = SUB_OPTIONS[category] ?? []
  if (validSubOptions.length > 0) {
    if (typeof subOption !== 'string' || !validSubOptions.includes(subOption))
      return NextResponse.json({ error: 'Please select a sub-topic.' }, { status: 422 })
  }

  if (typeof message !== 'string' || message.trim().length < 10 || message.trim().length > 4000)
    return NextResponse.json({ error: 'Message must be between 10 and 4,000 characters.' }, { status: 422 })

  const cleanName      = name.trim()
  const cleanEmail     = (email as string).trim().toLowerCase()
  const cleanSubOption = typeof subOption === 'string' ? subOption.trim() : ''
  const cleanMessage   = (message as string).trim()

  const dest = process.env.SUPPORT_EMAIL ?? process.env.ADMIN_EMAIL ?? 'support@soulspacehealth.org'

  try {
    const notif = contactNotificationEmail({ name: cleanName, email: cleanEmail, category, subOption: cleanSubOption, message: cleanMessage })
    await sendEmail({ to: dest, subject: notif.subject, htmlContent: notif.htmlContent, textContent: notif.textContent })

    const ack = contactAckEmail(cleanName)
    await sendEmail({ to: cleanEmail, toName: cleanName, subject: ack.subject, htmlContent: ack.htmlContent, textContent: ack.textContent })
  } catch (err) {
    console.error('[contact] email send failed:', err)
    return NextResponse.json({ error: 'Something went wrong sending your message. Please try again.' }, { status: 500 })
  }

  // Persist submission for admin inbox (non-blocking — don't fail the request if this errors)
  try {
    const db = createServiceClient()
    await db.from('contact_submissions').insert({
      name: cleanName, email: cleanEmail, category,
      sub_option: cleanSubOption, message: cleanMessage,
    })
  } catch (err) {
    console.error('[contact] failed to persist submission:', err)
  }

  return NextResponse.json({ ok: true })
}

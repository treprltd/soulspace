import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/getAuthUser'

// ── Zod schemas ───────────────────────────────────────────────────────────────

const VALID_VALUABLE = [
  'mirror_reflection', 'season_insights', 'next_step', 'privacy_security',
  'calming_design', 'questions_asked',
] as const

const VALID_IMPROVEMENTS = [
  'deeper_reflections', 'more_topics', 'session_insights', 'audio_input',
  'therapist_sharing', 'mobile_app', 'nothing',
] as const

const FeedbackBaseSchema = z.object({
  overall_rating:  z.number().int().min(1).max(5).nullable().default(null),
  use_frequency:   z.enum(['first_time', 'few_times', 'weekly', 'daily_or_more']).nullable().default(null),
  most_valuable:   z.array(z.enum(VALID_VALUABLE)).default([]),
  ease_of_use:     z.enum(['very_difficult', 'difficult', 'neutral', 'easy', 'very_easy']).nullable().default(null),
  improvements:    z.array(z.enum(VALID_IMPROVEMENTS)).default([]),
  would_recommend: z.enum(['yes_already', 'yes_likely', 'maybe', 'not_yet']).nullable().default(null),
  comments:        z.string().max(2000).default(''),
})

// Guest submissions require a valid email
const GuestFeedbackSchema = FeedbackBaseSchema.extend({
  guest_email: z.string().email('A valid email address is required to submit feedback.'),
})

// ── POST /api/feedback ────────────────────────────────────────────────────────
// Submit beta feedback.
// - Authenticated users: standard submission (user_id stored, no email required)
// - Guest users: guest_email is mandatory; user_id is null

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const user     = await getAuthUser(req, supabase)

    const body = await req.json()

    if (user) {
      // ── Authenticated path ──────────────────────────────────────────────────
      const parsed  = FeedbackBaseSchema.parse(body)
      const service = createServiceClient()

      const { data, error } = await service
        .from('feedback')
        .insert({
          user_id:         user.id,
          guest_email:     null,
          overall_rating:  parsed.overall_rating,
          use_frequency:   parsed.use_frequency,
          most_valuable:   parsed.most_valuable,
          ease_of_use:     parsed.ease_of_use,
          improvements:    parsed.improvements,
          would_recommend: parsed.would_recommend,
          comments:        parsed.comments || null,
        })
        .select('id, created_at')
        .single()

      if (error) throw error
      return NextResponse.json({ ok: true, id: data.id }, { status: 201 })

    } else {
      // ── Guest path ──────────────────────────────────────────────────────────
      const parsed  = GuestFeedbackSchema.parse(body)
      const service = createServiceClient()

      const { data, error } = await service
        .from('feedback')
        .insert({
          user_id:         null,
          guest_email:     parsed.guest_email.toLowerCase().trim(),
          overall_rating:  parsed.overall_rating,
          use_frequency:   parsed.use_frequency,
          most_valuable:   parsed.most_valuable,
          ease_of_use:     parsed.ease_of_use,
          improvements:    parsed.improvements,
          would_recommend: parsed.would_recommend,
          comments:        parsed.comments || null,
        })
        .select('id, created_at')
        .single()

      if (error) throw error
      return NextResponse.json({ ok: true, id: data.id }, { status: 201 })
    }

  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 })
    }
    console.error('Feedback POST error:', err)
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 })
  }
}

// ── GET /api/feedback ─────────────────────────────────────────────────────────
// Returns the authenticated user's most recent feedback submission (if any),
// so the UI can show "last submitted X ago" and pre-fill answers.
// Guests cannot pre-fill (no stable identity) — return 200 with feedback: null.

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const user     = await getAuthUser(req, supabase)

    if (!user) {
      // Guests have no prior submissions to load
      return NextResponse.json({ feedback: null })
    }

    const service = createServiceClient()
    const { data, error } = await service
      .from('feedback')
      .select('id, overall_rating, use_frequency, most_valuable, ease_of_use, improvements, would_recommend, comments, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({ feedback: data ?? null })
  } catch (err) {
    console.error('Feedback GET error:', err)
    return NextResponse.json({ error: 'Failed to load feedback' }, { status: 500 })
  }
}

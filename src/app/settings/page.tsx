'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { NavBar } from '@/components/ui/NavBar'
import { createClient } from '@/lib/supabase/client'
import { FREE_SESSIONS_PER_MONTH } from '@/lib/stripe/plans'
import { GENDER_OPTIONS } from '@/components/ui/ProfileFields'
import { SETTINGS_MEMORY_SECTION } from '@/lib/copy/memory'
import type { User } from '@supabase/supabase-js'

interface SubscriptionStatus {
  planTier: 'free' | 'essentials' | 'insights'
  sessionsThisMonth: number | null
  limit: number | null
  authenticated: boolean
  subscription?: {
    status: string
    current_period_end: string
    cancel_at_period_end: boolean
  } | null
}

const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  essentials: 'Essentials',
  insights: 'Insights',
}

interface ProfileFields {
  firstName: string
  lastName:  string
  dob:       string
  phone:     string
  gender:    string
}

export default function Settings() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [subStatus, setSubStatus] = useState<SubscriptionStatus | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)

  // ── Memory & check-ins ─────────────────────────────────────────────────────
  // Memory itself (the "welcome back" greeting) is always-on and needs no
  // setting here. The only configurable piece is the opt-in check-in cadence.
  const [checkInFrequency, setCheckInFrequency] = useState<'off' | 'biweekly' | 'monthly'>('off')
  const [checkInLoaded, setCheckInLoaded] = useState(false)
  const [checkInSaving, setCheckInSaving] = useState(false)
  const [checkInSaved, setCheckInSaved] = useState(false)

  // ── Profile editing state ──────────────────────────────────────────────────
  const [profile, setProfile] = useState<ProfileFields>({ firstName: '', lastName: '', dob: '', phone: '', gender: '' })
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [profileEditing, setProfileEditing] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileSaved, setProfileSaved] = useState(false)
  // Keep a snapshot to allow cancel
  const [profileSnapshot, setProfileSnapshot] = useState<ProfileFields>({ firstName: '', lastName: '', dob: '', phone: '', gender: '' })

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const [{ data: { user } }, { data: { session } }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.auth.getSession(),
      ])
      setUser(user)

      // Pass Bearer token so server routes authenticate implicit-flow JWT
      const headers: Record<string, string> = {}
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`

      const [subData, profileData, memoryPrefsData] = await Promise.all([
        fetch('/api/subscription', { headers }).then(r => r.json()).catch(() => null),
        fetch('/api/user/profile', { headers }).then(r => r.json()).catch(() => null),
        fetch('/api/user/memory-preferences', { headers }).then(r => r.json()).catch(() => null),
      ])

      if (subData) setSubStatus(subData as SubscriptionStatus)

      const loadedFrequency = (memoryPrefsData as { checkInFrequency?: string } | null)?.checkInFrequency
      if (loadedFrequency === 'off' || loadedFrequency === 'biweekly' || loadedFrequency === 'monthly') {
        setCheckInFrequency(loadedFrequency)
      }
      setCheckInLoaded(true)

      if (profileData && !profileData.error) {
        const loaded: ProfileFields = {
          firstName: profileData.first_name ?? '',
          lastName:  profileData.last_name  ?? '',
          dob:       profileData.dob        ?? '',
          phone:     profileData.phone      ?? '',
          gender:    profileData.gender     ?? '',
        }
        setProfile(loaded)
        setProfileSnapshot(loaded)
        // If the profile is incomplete (any required field missing), open the
        // edit form immediately so the user sees exactly what needs filling in —
        // rather than showing blank fields silently with no clear call to action.
        const isIncomplete = !profileData.profile_complete ||
          !loaded.firstName || !loaded.lastName || !loaded.dob ||
          !loaded.phone || !loaded.gender
        if (isIncomplete) setProfileEditing(true)
      }
      setProfileLoaded(true)
    }

    load()
  }, [])

  function startEditing() {
    setProfileSnapshot({ ...profile })
    setProfileEditing(true)
    setProfileError('')
    setProfileSaved(false)
  }

  function cancelEditing() {
    setProfile({ ...profileSnapshot })
    setProfileEditing(false)
    setProfileError('')
  }

  async function saveProfile() {
    setProfileSaving(true)
    setProfileError('')
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`

      const res = await fetch('/api/user/profile', {
        method: 'POST',
        headers,
        body: JSON.stringify({
        firstName: profile.firstName,
        lastName:  profile.lastName,
        dob:       profile.dob,
        phone:     profile.phone,
        gender:    profile.gender,
      }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok || data.error) {
        setProfileError(data.error ?? 'Failed to save. Please try again.')
      } else {
        setProfileSnapshot({ ...profile })
        setProfileEditing(false)
        setProfileSaved(true)
        setTimeout(() => setProfileSaved(false), 3000)
      }
    } catch {
      setProfileError('Network error. Please try again.')
    } finally {
      setProfileSaving(false)
    }
  }

  async function saveCheckInFrequency(value: 'off' | 'biweekly' | 'monthly') {
    const previous = checkInFrequency
    setCheckInFrequency(value)   // optimistic — this is a low-stakes preference
    setCheckInSaving(true)
    setCheckInSaved(false)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`

      const res = await fetch('/api/user/memory-preferences', {
        method: 'POST',
        headers,
        body: JSON.stringify({ checkInFrequency: value }),
      })
      if (!res.ok) {
        setCheckInFrequency(previous)  // revert on failure
      } else {
        setCheckInSaved(true)
        setTimeout(() => setCheckInSaved(false), 2500)
      }
    } catch {
      setCheckInFrequency(previous)
    } finally {
      setCheckInSaving(false)
    }
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const headers: Record<string, string> = {}
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`

      await fetch('/api/user/data', { method: 'DELETE', headers })
      setDeleted(true)
      setTimeout(() => router.push('/'), 1500)
    } catch {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const handleManageBilling = async () => {
    setPortalLoading(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const headers: Record<string, string> = {}
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`

      const res = await fetch('/api/stripe/portal', { method: 'POST', headers })
      const data = await res.json() as { url?: string }
      if (data.url) window.location.href = data.url
    } catch {
      // noop
    } finally {
      setPortalLoading(false)
    }
  }

  const isPaid = subStatus && subStatus.planTier !== 'free'
  const periodEnd = subStatus?.subscription?.current_period_end
    ? new Date(subStatus.subscription.current_period_end).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      })
    : null
  const joinedDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      })
    : null

  return (
    <main style={{ background: '#060E18', minHeight: '100vh' }}>
      <NavBar />
      <div className="px-6 py-5 max-w-lg mx-auto animate-fade-in">
        <h2 className="font-serif font-light text-sand2 text-2xl mb-1.5 leading-tight">
          Your <em className="text-gold2">account.</em>
        </h2>
        <p className="text-sm text-mist mb-6">Manage your plan, profile, and data.</p>

        {/* ── Profile ── */}
        {user ? (
          <div
            className="rounded-xl p-4 mb-4"
            style={{ background: 'rgba(15,30,46,.6)', border: '1px solid rgba(245,237,216,.05)' }}
          >
            <div
              className="text-[12px] tracking-[.11em] uppercase text-mist mb-3 pb-1.5"
              style={{ borderBottom: '1px solid rgba(245,237,216,.04)' }}
            >
              Profile
            </div>

            <div className="flex justify-between items-center py-2 border-b border-white/[.04]">
              <div className="text-sm text-sand">Email</div>
              <div className="text-sm text-mist truncate max-w-[200px]">{user.email}</div>
            </div>

            {joinedDate && (
              <div className="flex justify-between items-center py-2 border-b border-white/[.04]">
                <div className="text-sm text-sand">Member since</div>
                <div className="text-sm text-mist">{joinedDate}</div>
              </div>
            )}

            <div className="flex justify-between items-center pt-3">
              <div>
                <div className="text-sm text-sand">Sign out</div>
                <div className="text-sm text-mist mt-0.5">Sign out of this device</div>
              </div>
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="text-sm px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ border: '1px solid rgba(212,64,64,.3)', color: 'rgba(212,64,64,.75)', background: 'transparent' }}
              >
                {signingOut ? 'Signing out…' : 'Sign out →'}
              </button>
            </div>
          </div>
        ) : subStatus && !subStatus.authenticated ? (
          <div
            className="rounded-xl p-4 mb-4"
            style={{ background: 'rgba(15,30,46,.6)', border: '1px solid rgba(245,237,216,.05)' }}
          >
            <div
              className="text-[12px] tracking-[.11em] uppercase text-mist mb-3 pb-1.5"
              style={{ borderBottom: '1px solid rgba(245,237,216,.04)' }}
            >
              Profile
            </div>
            <p className="text-sm text-mist mb-3 leading-relaxed">
              You&apos;re browsing without an account. Sign in to save sessions and access your history.
            </p>
            <Link href="/auth/signin" className="btn-outline text-sm py-2 px-4 inline-block">
              Sign in →
            </Link>
          </div>
        ) : null}

        {/* ── Personal info ── */}
        {user && profileLoaded && (
          <div
            className="rounded-xl p-4 mb-4"
            style={{ background: 'rgba(15,30,46,.6)', border: '1px solid rgba(245,237,216,.05)' }}
          >
            {/* Incomplete-profile notice — shown when edit form auto-opens because
                fields are missing. Disappears once the user saves successfully. */}
            {profileEditing && (!profile.firstName || !profile.lastName || !profile.dob || !profile.phone || !profile.gender) && !profileSaved && (
              <div
                className="rounded-lg px-3 py-2.5 text-xs mb-3 leading-relaxed"
                style={{ background: 'rgba(201,168,76,.07)', border: '1px solid rgba(201,168,76,.25)', color: 'var(--sand2)' }}
              >
                <span style={{ color: 'var(--gold2)', fontWeight: 600 }}>Required:</span>{' '}
                Your account needs a first name, last name, date of birth, phone number, and gender to be complete. These details are used only for account verification and communication.
              </div>
            )}

            <div className="flex items-center justify-between mb-3 pb-1.5" style={{ borderBottom: '1px solid rgba(245,237,216,.04)' }}>
              <div className="text-[12px] tracking-[.11em] uppercase text-mist">Personal info</div>
              {!profileEditing ? (
                <button
                  onClick={startEditing}
                  className="text-xs px-2.5 py-1 rounded-md transition-opacity hover:opacity-80"
                  style={{ color: 'var(--gold2)', border: '1px solid rgba(201,168,76,.2)', background: 'rgba(201,168,76,.06)' }}
                >
                  Edit
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={cancelEditing}
                    className="text-xs px-2.5 py-1 rounded-md transition-opacity hover:opacity-80"
                    style={{ color: 'var(--mist)', border: '1px solid rgba(213,226,235,.52)', background: 'transparent' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveProfile}
                    disabled={profileSaving}
                    className="text-xs px-2.5 py-1 rounded-md transition-opacity hover:opacity-80 disabled:opacity-50"
                    style={{ color: '#060E18', background: 'var(--gold)', border: 'none', fontWeight: 600 }}
                  >
                    {profileSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              )}
            </div>

            {/* Success toast */}
            {profileSaved && (
              <div
                className="rounded-lg px-3 py-2 text-xs mb-3"
                style={{ background: 'rgba(42,140,122,.08)', border: '1px solid rgba(42,140,122,.2)', color: 'var(--teal2)' }}
              >
                ✓ Profile updated successfully.
              </div>
            )}

            {/* Error */}
            {profileError && (
              <div
                className="rounded-lg px-3 py-2 text-xs mb-3"
                style={{ background: 'rgba(212,64,64,.06)', border: '1px solid rgba(212,64,64,.2)', color: 'rgba(212,64,64,.8)' }}
              >
                {profileError}
              </div>
            )}

            {/* Email — always read-only */}
            <div className="flex justify-between items-center py-2.5 border-b border-white/[.04]">
              <div className="text-sm text-sand">Email</div>
              <div className="text-sm truncate max-w-[200px]" style={{ color: 'rgba(213,226,235,.65)' }}>
                {user.email}
              </div>
            </div>

            {/* First name */}
            <div className="flex justify-between items-center py-2.5 border-b border-white/[.04]">
              <div className="text-sm text-sand">First name</div>
              {profileEditing ? (
                <input
                  type="text"
                  value={profile.firstName}
                  onChange={e => setProfile(p => ({ ...p, firstName: e.target.value }))}
                  placeholder="First name"
                  className="text-xs text-right bg-transparent outline-none border-b"
                  style={{
                    color: 'var(--sand)',
                    borderColor: 'rgba(201,168,76,.3)',
                    width: 'clamp(90px, 40%, 140px)',
                    minWidth: 0,
                    paddingBottom: '2px',
                  }}
                />
              ) : (
                <div className="text-xs text-mist">{profile.firstName || <span style={{ color: 'rgba(213,226,235,.60)' }}>—</span>}</div>
              )}
            </div>

            {/* Last name */}
            <div className="flex justify-between items-center py-2.5 border-b border-white/[.04]">
              <div className="text-sm text-sand">Last name</div>
              {profileEditing ? (
                <input
                  type="text"
                  value={profile.lastName}
                  onChange={e => setProfile(p => ({ ...p, lastName: e.target.value }))}
                  placeholder="Last name"
                  className="text-xs text-right bg-transparent outline-none border-b"
                  style={{
                    color: 'var(--sand)',
                    borderColor: 'rgba(201,168,76,.3)',
                    width: 'clamp(90px, 40%, 140px)',
                    minWidth: 0,
                    paddingBottom: '2px',
                  }}
                />
              ) : (
                <div className="text-xs text-mist">{profile.lastName || <span style={{ color: 'rgba(213,226,235,.60)' }}>—</span>}</div>
              )}
            </div>

            {/* Date of birth */}
            <div className="flex justify-between items-center py-2.5 border-b border-white/[.04]">
              <div className="text-sm text-sand">Date of birth</div>
              {profileEditing ? (
                <input
                  type="date"
                  value={profile.dob}
                  onChange={e => setProfile(p => ({ ...p, dob: e.target.value }))}
                  className="text-xs text-right bg-transparent outline-none border-b"
                  style={{
                    color: 'var(--sand)',
                    borderColor: 'rgba(201,168,76,.3)',
                    width: 'clamp(90px, 40%, 140px)',
                    minWidth: 0,
                    paddingBottom: '2px',
                    colorScheme: 'dark' as const,
                  }}
                />
              ) : (
                <div className="text-xs text-mist">
                  {profile.dob
                    ? new Date(profile.dob + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                    : <span style={{ color: 'rgba(213,226,235,.60)' }}>—</span>}
                </div>
              )}
            </div>

            {/* Phone */}
            <div className="flex justify-between items-center py-2.5 border-b border-white/[.04]">
              <div className="text-sm text-sand">Phone</div>
              {profileEditing ? (
                <input
                  type="tel"
                  value={profile.phone}
                  onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
                  placeholder="+1 555 000 0000"
                  className="text-xs text-right bg-transparent outline-none border-b"
                  style={{
                    color: 'var(--sand)',
                    borderColor: 'rgba(201,168,76,.3)',
                    width: 'clamp(90px, 40%, 140px)',
                    minWidth: 0,
                    paddingBottom: '2px',
                  }}
                />
              ) : (
                <div className="text-xs text-mist">{profile.phone || <span style={{ color: 'rgba(213,226,235,.60)' }}>—</span>}</div>
              )}
            </div>

            {/* Gender identity */}
            <div className="flex justify-between items-center pt-2.5">
              <div className="text-sm text-sand">Gender identity</div>
              {profileEditing ? (
                <select
                  value={profile.gender}
                  onChange={e => setProfile(p => ({ ...p, gender: e.target.value }))}
                  className="text-xs text-right bg-transparent outline-none border-b"
                  style={{
                    color: 'var(--sand)',
                    borderColor: 'rgba(201,168,76,.3)',
                    width: 'clamp(90px, 40%, 160px)',
                    minWidth: 0,
                    paddingBottom: '2px',
                    colorScheme: 'dark' as const,
                    cursor: 'pointer',
                  }}
                >
                  <option value="" disabled style={{ background: '#0F1E2E' }}>Select…</option>
                  {GENDER_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value} style={{ background: '#0F1E2E' }}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-xs text-mist">
                  {GENDER_OPTIONS.find(o => o.value === profile.gender)?.label
                    || <span style={{ color: 'rgba(213,226,235,.60)' }}>—</span>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Subscription ── */}
        <div
          className="rounded-xl p-4 mb-4"
          style={{ background: 'rgba(15,30,46,.6)', border: '1px solid rgba(245,237,216,.05)' }}
        >
          <div
            className="text-[12px] tracking-[.11em] uppercase text-mist mb-3 pb-1.5"
            style={{ borderBottom: '1px solid rgba(245,237,216,.04)' }}
          >
            Subscription
          </div>

          {subStatus ? (
            <>
              <div className="flex justify-between items-center py-2 border-b border-white/[.04]">
                <div>
                  <div className="text-sm text-sand">Current plan</div>
                  <div className="text-xs text-mist mt-0.5">
                    {isPaid ? 'Unlimited sessions' : `${FREE_SESSIONS_PER_MONTH} sessions per month`}
                  </div>
                </div>
                <div
                  className="px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{
                    background: isPaid ? 'rgba(201,168,76,.1)' : 'rgba(139,167,184,.08)',
                    color: isPaid ? 'var(--gold2)' : 'var(--mist)',
                    border: isPaid ? '1px solid rgba(201,168,76,.2)' : '1px solid rgba(139,167,184,.15)',
                  }}
                >
                  {PLAN_LABELS[subStatus.planTier] ?? 'Free'}
                </div>
              </div>

              {subStatus.authenticated && subStatus.planTier === 'free' && (
                <div className="flex justify-between items-center py-2 border-b border-white/[.04]">
                  <div className="text-sm text-sand">Sessions this month</div>
                  <div className="text-sm text-mist">
                    {subStatus.sessionsThisMonth ?? 0} / {FREE_SESSIONS_PER_MONTH}
                  </div>
                </div>
              )}

              {isPaid && periodEnd && (
                <div className="flex justify-between items-center py-2 border-b border-white/[.04]">
                  <div className="text-sm text-sand">
                    {subStatus.subscription?.cancel_at_period_end ? 'Cancels on' : 'Renews on'}
                  </div>
                  <div className="text-sm text-mist">{periodEnd}</div>
                </div>
              )}

              <div className="pt-3">
                {isPaid ? (
                  <button
                    onClick={handleManageBilling}
                    disabled={portalLoading}
                    className="btn-outline text-sm w-full py-2.5 disabled:opacity-50"
                  >
                    {portalLoading ? 'Opening…' : 'Manage billing & subscription →'}
                  </button>
                ) : (
                  <Link href="/pricing" className="btn-primary text-sm block text-center w-full py-2.5">
                    Upgrade plan →
                  </Link>
                )}
              </div>
            </>
          ) : (
            <div className="py-3 text-center">
              <div
                className="w-5 h-5 rounded-full animate-spin-slow mx-auto"
                style={{ border: '2px solid rgba(201,168,76,.1)', borderTopColor: 'var(--gold)' }}
              />
            </div>
          )}
        </div>

        {/* ── What is stored ── */}
        <div
          className="rounded-xl p-4 mb-4"
          style={{ background: 'rgba(15,30,46,.6)', border: '1px solid rgba(245,237,216,.05)' }}
        >
          <div
            className="text-[12px] tracking-[.11em] uppercase text-mist mb-2 pb-1.5"
            style={{ borderBottom: '1px solid rgba(245,237,216,.04)' }}
          >
            Phase 1 — what is stored
          </div>
          {[
            { label: 'Session content', sub: 'Emotion tags, context text, Mirror output — encrypted' },
            { label: 'Session count', sub: 'Number and timestamps — for return measurement' },
            { label: 'Resonance tap result', sub: 'Accurate / Not quite — anonymous aggregate' },
          ].map(({ label, sub }) => (
            <div key={label} className="flex justify-between items-center py-2.5 border-b border-white/[.04] last:border-0">
              <div>
                <div className="text-sm text-sand">{label}</div>
                <div className="text-xs text-mist mt-0.5">{sub}</div>
              </div>
              <div
                className="w-7 h-4 rounded-full relative flex-shrink-0"
                style={{ background: 'var(--gold)' }}
              >
                <div className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full bg-white" />
              </div>
            </div>
          ))}
        </div>

        {/* ── Memory & check-ins (locked copy — see src/lib/copy/memory.ts) ── */}
        <div
          className="rounded-xl p-4 mb-4"
          style={{ background: 'rgba(15,30,46,.6)', border: '1px solid rgba(245,237,216,.05)' }}
        >
          <div
            className="text-[12px] tracking-[.11em] uppercase text-mist mb-2 pb-1.5"
            style={{ borderBottom: '1px solid rgba(245,237,216,.04)' }}
          >
            {SETTINGS_MEMORY_SECTION.heading}
          </div>
          <p className="text-sm leading-relaxed mb-4" style={{ color: 'rgba(245,237,216,.6)' }}>
            {SETTINGS_MEMORY_SECTION.body}
          </p>

          <div className="text-xs text-mist mb-2">{SETTINGS_MEMORY_SECTION.toggleLabel}</div>
          <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label={SETTINGS_MEMORY_SECTION.toggleLabel}>
            {SETTINGS_MEMORY_SECTION.frequencyOptions.map(opt => {
              const active = checkInFrequency === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={!checkInLoaded || checkInSaving}
                  onClick={() => saveCheckInFrequency(opt.value as 'off' | 'biweekly' | 'monthly')}
                  className="px-3.5 py-2 text-xs rounded-lg transition-opacity hover:opacity-80 disabled:opacity-50"
                  style={{
                    border: active ? '1px solid rgba(201,168,76,.4)' : '1px solid rgba(245,237,216,.08)',
                    background: active ? 'rgba(201,168,76,.1)' : 'transparent',
                    color: active ? 'var(--gold2)' : 'rgba(245,237,216,.76)',
                  }}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
          {checkInSaved && (
            <p className="text-xs mt-2" style={{ color: 'rgba(201,168,76,.6)' }}>Saved.</p>
          )}
        </div>

        {/* ── Delete data ── */}
        <div
          className="rounded-xl p-4 mb-4"
          style={{ background: 'rgba(15,30,46,.6)', border: '1px solid rgba(245,237,216,.05)' }}
        >
          <div
            className="text-[12px] tracking-[.11em] uppercase text-mist mb-3 pb-1.5"
            style={{ borderBottom: '1px solid rgba(245,237,216,.04)' }}
          >
            Delete your data
          </div>

          {deleted ? (
            <p className="text-sm text-mist text-center py-2">All data deleted. Redirecting…</p>
          ) : (
            <>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="w-full py-2.5 text-sm rounded-lg text-center mb-2 transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ border: '1px solid rgba(212,64,64,.3)', color: 'rgba(212,64,64,.75)', background: 'transparent' }}
              >
                {confirmDelete
                  ? 'Tap again to confirm — this is permanent'
                  : 'Delete all my sessions and data →'}
              </button>
              <p className="text-xs leading-relaxed" style={{ color: 'rgba(213,226,235,.60)' }}>
                Permanent. Encrypted. No recycle bin. CPRA compliant.<br />
                Full privacy dashboard ships in Phase 2.
              </p>
            </>
          )}
        </div>

        <p className="text-xs leading-relaxed" style={{ color: 'rgba(213,226,235,.60)' }}>
          Phase 2 will add: toggle controls per data type, export, assessment reset, notification preferences.
        </p>
      </div>
    </main>
  )
}

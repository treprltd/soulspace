'use client'

/**
 * ProfileFields — shared form fields for first/last name, DOB, phone, and gender.
 * Used by /auth/register (new user sign-up) and /profile/setup (existing
 * users completing their profile).
 *
 * The parent owns all state; this component is purely presentational.
 */

import React from 'react'

// ── Shared style constants ────────────────────────────────────────────────────

export const inputClass = `
  w-full px-4 py-3 rounded-xl text-sm text-sand2 focus:outline-none transition-colors
  placeholder:text-mist/80
`.trim()

export const inputStyle = {
  background: 'rgba(245,237,216,.04)',
  border: '1px solid rgba(245,237,216,.08)',
}

export const inputFocusStyle = {
  background: 'rgba(245,237,216,.04)',
  border: '1px solid rgba(201,168,76,.35)',
}

// ── Gender options ────────────────────────────────────────────────────────────

export const GENDER_OPTIONS = [
  { value: 'male',              label: 'Man' },
  { value: 'female',            label: 'Woman' },
  { value: 'non_binary',        label: 'Non-binary' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
] as const

export type GenderValue = (typeof GENDER_OPTIONS)[number]['value']

// ── Validation helper (used by both pages and the POST route on the server) ───

/** Returns 18-years-ago date string formatted as YYYY-MM-DD. */
export function maxDobDate(): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 18)
  return d.toISOString().split('T')[0]
}

/**
 * Client-side profile validation — returns a map of field → error string.
 *
 * Phone and gender are optional: they're demographic/contact metadata, not
 * needed for auth (magic-link email only) or for using the product itself.
 * Requiring them upfront was pure signup friction with no functional payoff —
 * if provided, they're still validated below. First/last name and DOB stay
 * required: DOB enforces the 18+ compliance boundary on account creation.
 */
export function validateProfileFields(values: {
  firstName: string
  lastName:  string
  dob:       string
  phone:     string
  gender:    string
}): Record<string, string> {
  const errs: Record<string, string> = {}

  if (!values.firstName.trim()) errs.firstName = 'First name is required.'
  if (!values.lastName.trim())  errs.lastName  = 'Last name is required.'

  if (!values.dob) {
    errs.dob = 'Date of birth is required.'
  } else {
    const dobDate   = new Date(values.dob)
    const threshold = new Date()
    threshold.setFullYear(threshold.getFullYear() - 18)
    if (isNaN(dobDate.getTime()) || dobDate > threshold) {
      errs.dob = 'You must be 18 or older to create an account.'
    }
  }

  if (values.phone.trim()) {
    const digits = values.phone.replace(/\D/g, '')
    if (digits.length < 7 || digits.length > 15) {
      errs.phone = 'Please enter a valid phone number (include country code).'
    }
  }

  if (values.gender) {
    const validGenders = GENDER_OPTIONS.map(o => o.value) as string[]
    if (!validGenders.includes(values.gender)) {
      errs.gender = 'Please select your gender identity.'
    }
  }

  return errs
}

// ── Field wrapper ─────────────────────────────────────────────────────────────

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label:    string
  hint?:    string
  error?:   string | null
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[17px] tracking-[.08em] uppercase text-mist pl-0.5">{label}</label>
      {children}
      {hint && !error && (
        <p className="text-[17px] pl-0.5" style={{ color: 'rgba(213,226,235,.65)' }}>{hint}</p>
      )}
      {error && (
        <p className="text-xs leading-relaxed" style={{ color: 'var(--danger)' }}>{error}</p>
      )}
    </div>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ProfileFieldValues {
  firstName: string
  lastName:  string
  dob:       string
  phone:     string
  gender:    string
}

export interface ProfileFieldSetters {
  setFirstName: (v: string) => void
  setLastName:  (v: string) => void
  setDob:       (v: string) => void
  setPhone:     (v: string) => void
  setGender:    (v: string) => void
}

interface ProfileFieldsProps {
  values:       ProfileFieldValues
  setters:      ProfileFieldSetters
  errors:       Record<string, string>
  focusedField: string | null
  onFocus:      (field: string) => void
  onBlur:       () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ProfileFields({
  values,
  setters,
  errors,
  focusedField,
  onFocus,
  onBlur,
}: ProfileFieldsProps) {
  return (
    <>
      {/* Name row */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name" error={errors.firstName}>
          <input
            type="text"
            value={values.firstName}
            onChange={e => setters.setFirstName(e.target.value)}
            onFocus={() => onFocus('firstName')}
            onBlur={onBlur}
            placeholder="Jane"
            autoComplete="given-name"
            className={inputClass}
            style={focusedField === 'firstName' ? inputFocusStyle : inputStyle}
          />
        </Field>
        <Field label="Last name" error={errors.lastName}>
          <input
            type="text"
            value={values.lastName}
            onChange={e => setters.setLastName(e.target.value)}
            onFocus={() => onFocus('lastName')}
            onBlur={onBlur}
            placeholder="Doe"
            autoComplete="family-name"
            className={inputClass}
            style={focusedField === 'lastName' ? inputFocusStyle : inputStyle}
          />
        </Field>
      </div>

      {/* Date of birth */}
      <Field label="Date of birth" error={errors.dob}>
        <input
          type="date"
          value={values.dob}
          onChange={e => setters.setDob(e.target.value)}
          onFocus={() => onFocus('dob')}
          onBlur={onBlur}
          max={maxDobDate()}
          autoComplete="bday"
          className={inputClass}
          style={{
            ...(focusedField === 'dob' ? inputFocusStyle : inputStyle),
            colorScheme: 'dark' as const,
          }}
        />
      </Field>

      {/* Gender identity — optional */}
      <Field label="Gender identity (optional)" error={errors.gender}>
        <select
          value={values.gender}
          onChange={e => setters.setGender(e.target.value)}
          onFocus={() => onFocus('gender')}
          onBlur={onBlur}
          className={inputClass}
          style={{
            ...(focusedField === 'gender' ? inputFocusStyle : inputStyle),
            colorScheme: 'dark' as const,
            cursor: 'pointer',
          }}
        >
          <option value="" style={{ background: '#0F1E2E' }}>
            Prefer not to answer
          </option>
          {GENDER_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value} style={{ background: '#0F1E2E' }}>
              {opt.label}
            </option>
          ))}
        </select>
      </Field>

      {/* Phone — optional */}
      <Field
        label="Phone number (optional)"
        hint="Include country code. Used only for account communications."
        error={errors.phone}
      >
        <input
          type="tel"
          value={values.phone}
          onChange={e => setters.setPhone(e.target.value)}
          onFocus={() => onFocus('phone')}
          onBlur={onBlur}
          placeholder="+1 555 000 0000"
          autoComplete="tel"
          className={inputClass}
          style={focusedField === 'phone' ? inputFocusStyle : inputStyle}
        />
      </Field>
    </>
  )
}

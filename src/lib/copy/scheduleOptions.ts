// ── PROVISIONAL copy — check-in schedule options ───────────────────────────
//
// These are the *new* user-chosen cadence options (Lever: "let them choose
// their own reflection schedule"). They are deliberately kept OUT of the frozen
// src/lib/copy/memory.ts so the locked strings stay untouched and the
// check-frozen-copy.js guard keeps passing.
//
// ⚠️  The wording below is PROVISIONAL and NOT yet locked. It must clear the
// same copy word-review as the frozen check-in copy before it ships to prod
// (the founder specifically asked to review the new options together — beta
// research named the check-in tone as trust-defining). Change freely until
// then; once approved, fold these into memory.ts + the guard in lockstep.
//
// The 'off' / 'biweekly' / 'monthly' entries are re-used VERBATIM from the
// frozen SETTINGS_MEMORY_SECTION so we never restate locked copy here.

import { SETTINGS_MEMORY_SECTION } from './memory'

/** Stored cadence values — must match the DB check constraint (migration 023). */
export type CheckInFrequency = 'off' | 'weekly' | 'biweekly' | 'monthly' | 'custom_days'

export interface ScheduleOption {
  value: CheckInFrequency
  label: string
  /** When true, the UI reveals a weekday picker (writes users.check_in_days). */
  needsDays?: boolean
}

const FROZEN = SETTINGS_MEMORY_SECTION.frequencyOptions // off, biweekly, monthly (verbatim, locked)
const opt = (value: CheckInFrequency): ScheduleOption =>
  FROZEN.find(o => o.value === value) as ScheduleOption

/**
 * Full option set for the Settings check-in picker, in display order.
 * Locked entries come from the frozen section; the rest are provisional.
 */
export const CHECK_IN_SCHEDULE_OPTIONS: readonly ScheduleOption[] = [
  opt('off'),                                                    // locked
  { value: 'weekly',      label: 'Weekly' },                     // provisional
  { value: 'custom_days', label: 'On days I choose', needsDays: true }, // provisional
  opt('biweekly'),                                               // locked ("Every few weeks")
  opt('monthly'),                                                // locked ("About monthly")
] as const

/** Weekday chips for the custom_days picker. Value = JS Date.getUTCDay() (0=Sun). */
export const WEEKDAY_OPTIONS: readonly { value: number; label: string; short: string }[] = [
  { value: 1, label: 'Monday',    short: 'Mon' },
  { value: 2, label: 'Tuesday',   short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday',  short: 'Thu' },
  { value: 5, label: 'Friday',    short: 'Fri' },
  { value: 6, label: 'Saturday',  short: 'Sat' },
  { value: 0, label: 'Sunday',    short: 'Sun' },
] as const

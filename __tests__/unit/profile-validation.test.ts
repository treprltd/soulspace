/**
 * Unit tests — ProfileFields validation utilities
 *
 * Tests validateProfileFields(), GENDER_OPTIONS, and maxDobDate()
 * from src/components/ui/ProfileFields.tsx.
 *
 * These are pure logic tests — no API calls, no browser, no DB.
 * Run with: npm test  (included in CI automatically)
 */

import {
  validateProfileFields,
  GENDER_OPTIONS,
  maxDobDate,
} from '@/components/ui/ProfileFields'

// ── Shared valid base fixture ─────────────────────────────────────────────────

const VALID: Parameters<typeof validateProfileFields>[0] = {
  firstName: 'Jane',
  lastName:  'Doe',
  dob:       '1990-06-15',
  phone:     '+15550001234',
  gender:    'female',
}

// ── validateProfileFields ─────────────────────────────────────────────────────

describe('validateProfileFields — passes', () => {
  test('returns no errors for all-valid fields', () => {
    expect(validateProfileFields(VALID)).toEqual({})
  })

  test('accepts all four gender values', () => {
    for (const { value } of GENDER_OPTIONS) {
      const errs = validateProfileFields({ ...VALID, gender: value })
      expect(errs.gender).toBeUndefined()
    }
  })

  test('accepts international phone formats', () => {
    const phones = ['+447911123456', '+919876543210', '+12125551234', '0044207946001']
    for (const phone of phones) {
      const errs = validateProfileFields({ ...VALID, phone })
      expect(errs.phone).toBeUndefined()
    }
  })

  test('accepts dob exactly 18 years ago', () => {
    const errs = validateProfileFields({ ...VALID, dob: maxDobDate() })
    expect(errs.dob).toBeUndefined()
  })
})

describe('validateProfileFields — firstName', () => {
  test('fails with empty string', () => {
    expect(validateProfileFields({ ...VALID, firstName: '' }).firstName).toBeDefined()
  })

  test('fails with whitespace-only string', () => {
    expect(validateProfileFields({ ...VALID, firstName: '   ' }).firstName).toBeDefined()
  })

  test('passes with single character', () => {
    expect(validateProfileFields({ ...VALID, firstName: 'A' }).firstName).toBeUndefined()
  })
})

describe('validateProfileFields — lastName', () => {
  test('fails with empty string', () => {
    expect(validateProfileFields({ ...VALID, lastName: '' }).lastName).toBeDefined()
  })

  test('fails with whitespace-only string', () => {
    expect(validateProfileFields({ ...VALID, lastName: '   ' }).lastName).toBeDefined()
  })
})

describe('validateProfileFields — dob', () => {
  test('fails with empty string', () => {
    expect(validateProfileFields({ ...VALID, dob: '' }).dob).toBeDefined()
  })

  test('fails for user under 18 (born today)', () => {
    const today = new Date().toISOString().split('T')[0]
    expect(validateProfileFields({ ...VALID, dob: today }).dob).toBeDefined()
  })

  test('fails for user born 17 years ago', () => {
    const d = new Date()
    d.setFullYear(d.getFullYear() - 17)
    const dob = d.toISOString().split('T')[0]
    expect(validateProfileFields({ ...VALID, dob }).dob).toBeDefined()
  })

  test('fails with clearly invalid date string', () => {
    expect(validateProfileFields({ ...VALID, dob: 'not-a-date' }).dob).toBeDefined()
  })
})

describe('validateProfileFields — phone', () => {
  test('passes with empty string (optional field)', () => {
    expect(validateProfileFields({ ...VALID, phone: '' }).phone).toBeUndefined()
  })

  test('fails with too-short number (under 7 digits)', () => {
    expect(validateProfileFields({ ...VALID, phone: '12345' }).phone).toBeDefined()
  })

  test('fails with too-long number (over 15 digits)', () => {
    expect(validateProfileFields({ ...VALID, phone: '+1234567890123456' }).phone).toBeDefined()
  })

  test('passes with exactly 7 digits', () => {
    expect(validateProfileFields({ ...VALID, phone: '1234567' }).phone).toBeUndefined()
  })
})

describe('validateProfileFields — gender', () => {
  test('passes with empty string (optional field)', () => {
    expect(validateProfileFields({ ...VALID, gender: '' }).gender).toBeUndefined()
  })

  test('fails with arbitrary string not in allowed set', () => {
    expect(validateProfileFields({ ...VALID, gender: 'other' }).gender).toBeDefined()
  })

  test('fails with mixed-case variant (case-sensitive)', () => {
    expect(validateProfileFields({ ...VALID, gender: 'Male' }).gender).toBeDefined()
  })

  test('fails with SQL injection attempt', () => {
    expect(validateProfileFields({ ...VALID, gender: "'; DROP TABLE users;--" }).gender).toBeDefined()
  })

  test('male is valid', () => {
    expect(validateProfileFields({ ...VALID, gender: 'male' }).gender).toBeUndefined()
  })

  test('female is valid', () => {
    expect(validateProfileFields({ ...VALID, gender: 'female' }).gender).toBeUndefined()
  })

  test('non_binary is valid', () => {
    expect(validateProfileFields({ ...VALID, gender: 'non_binary' }).gender).toBeUndefined()
  })

  test('prefer_not_to_say is valid', () => {
    expect(validateProfileFields({ ...VALID, gender: 'prefer_not_to_say' }).gender).toBeUndefined()
  })
})

describe('validateProfileFields — multiple errors', () => {
  test('returns errors only for required fields when phone/gender are blank', () => {
    const errs = validateProfileFields({
      firstName: '',
      lastName:  '',
      dob:       '',
      phone:     '',
      gender:    '',
    })
    expect(Object.keys(errs)).toHaveLength(3)
    expect(errs.firstName).toBeDefined()
    expect(errs.lastName).toBeDefined()
    expect(errs.dob).toBeDefined()
    expect(errs.phone).toBeUndefined()
    expect(errs.gender).toBeUndefined()
  })
})

// ── maxDobDate ────────────────────────────────────────────────────────────────

describe('maxDobDate', () => {
  test('returns a YYYY-MM-DD formatted string', () => {
    expect(maxDobDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  test('is approximately 18 years ago (within 2 days for timezone safety)', () => {
    const result    = new Date(maxDobDate())
    const expected  = new Date()
    expected.setFullYear(expected.getFullYear() - 18)
    const diffMs = Math.abs(result.getTime() - expected.getTime())
    expect(diffMs).toBeLessThan(2 * 24 * 60 * 60 * 1000)   // 2 day tolerance
  })

  test('is always in the past', () => {
    expect(new Date(maxDobDate()).getTime()).toBeLessThan(Date.now())
  })
})

// ── GENDER_OPTIONS ────────────────────────────────────────────────────────────

describe('GENDER_OPTIONS', () => {
  test('has exactly 4 options', () => {
    expect(GENDER_OPTIONS).toHaveLength(4)
  })

  test('every option has a non-empty value and label', () => {
    for (const opt of GENDER_OPTIONS) {
      expect(opt.value).toBeTruthy()
      expect(opt.label).toBeTruthy()
    }
  })

  test('includes expected values', () => {
    const values = GENDER_OPTIONS.map(o => o.value)
    expect(values).toContain('male')
    expect(values).toContain('female')
    expect(values).toContain('non_binary')
    expect(values).toContain('prefer_not_to_say')
  })

  test('values are lowercase with underscores (DB-safe)', () => {
    for (const { value } of GENDER_OPTIONS) {
      expect(value).toMatch(/^[a-z_]+$/)
    }
  })

  test('no duplicate values', () => {
    const values = GENDER_OPTIONS.map(o => o.value)
    expect(new Set(values).size).toBe(values.length)
  })
})

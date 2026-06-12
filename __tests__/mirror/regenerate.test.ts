/**
 * Mirror Regenerate — "Not quite" correction loop
 * Kept separate from mirror.test.ts so its 25/30 pass-rate threshold is untouched.
 * Run: npm run test:mirror
 *
 * classifySafety is mocked here — these tests exercise the Mirror (Sonnet)
 * regeneration path. The classifier itself is covered by
 * __tests__/safety/classifier.test.ts and __tests__/mirror/mirror.test.ts.
 */

import { runMirror, SafetyFlagError } from '@/lib/mirror'
import type { MirrorInput } from '@/lib/mirror'
import { classifySafety } from '@/lib/safety/classifier'

jest.mock('@/lib/safety/classifier')

const mockClassifySafety = classifySafety as jest.MockedFunction<typeof classifySafety>

jest.setTimeout(60000)

const CLINICAL_TERMS = [
  'anxiety disorder', 'depression', 'trauma', 'ptsd', 'ocd', 'adhd',
  'bipolar', 'disorder', 'diagnosis', 'diagnose', 'symptom', 'treatment',
  'therapy', 'therapist', 'medication', 'prescription', 'pathology',
]

function expectMirrorShape(output: { carrying: string; underneath: string; question: string }) {
  expect(output.carrying.length).toBeGreaterThan(20)
  expect(output.underneath.length).toBeGreaterThan(20)
  expect(output.question).toContain('?')

  const fullText = [output.carrying, output.underneath, output.question].join(' ').toLowerCase()
  const clinicalHits = CLINICAL_TERMS.filter(t => fullText.includes(t))
  expect(clinicalHits).toEqual([])
}

beforeEach(() => {
  mockClassifySafety.mockResolvedValue({ flagged: false, flagType: null, confidence: 0 })
})

describe('Mirror regenerate — "Not quite" correction loop (live API)', () => {
  it('regenerates a reflection that takes the correction into account (branch A)', async () => {
    const output = await runMirror({
      branch: 'A',
      emotionTags: ['Overwhelmed', 'Stuck'],
      intensity: 7,
      contextText: 'I keep going back and forth on whether to take this job. Every time I decide yes, something pulls me back.',
      correctionContext: 'It missed that this is really about my dad, not the job.',
    })
    expectMirrorShape(output)
  })

  it('regenerates a reflection that takes the correction into account (branch D)', async () => {
    const output = await runMirror({
      branch: 'D',
      emotionTags: ['Lonely', 'Exhausted'],
      intensity: 8,
      contextText: 'I\'ve been holding this for a year without telling anyone. I don\'t know how to start.',
      correctionContext: 'It missed that the person I\'d tell is my sister, and we don\'t talk anymore.',
    })
    expectMirrorShape(output)
  })

  it('produces a different reflection than the same input without correction', async () => {
    const input: MirrorInput = {
      branch: 'B',
      emotionTags: ['Uncertain', 'Numb'],
      intensity: 4,
      contextText: 'I know something is off but I can\'t put words to it. Everyone else thinks I\'m fine.',
    }

    const without = await runMirror(input)
    const withCorrection = await runMirror({
      ...input,
      correctionContext: 'It missed that this started right after I moved away from my hometown.',
    })

    expectMirrorShape(withCorrection)
    expect(withCorrection.carrying).not.toBe(without.carrying)
  })
})

describe('Mirror regenerate — safety classifier covers correction text', () => {
  it('classifies contextText + correctionContext together, before the Mirror call', async () => {
    mockClassifySafety.mockResolvedValueOnce({ flagged: true, flagType: 'self_harm', confidence: 0.9 })

    const input: MirrorInput = {
      branch: 'A',
      emotionTags: ['Overwhelmed'],
      intensity: 5,
      contextText: 'Some context text here.',
      correctionContext: 'Some correction text here.',
    }

    await expect(runMirror(input)).rejects.toBeInstanceOf(SafetyFlagError)
    expect(mockClassifySafety).toHaveBeenCalledWith('Some context text here.\nSome correction text here.')
  })
})

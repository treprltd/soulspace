/**
 * Safety classifier — fail-safe behaviour (compliance finding #3).
 *
 * Unlike __tests__/safety/classifier.test.ts (which makes real API calls and is
 * excluded from the default suite), this test MOCKS the Anthropic SDK so it runs
 * in CI with no API key. It locks in the crucial property: when the classifier
 * response cannot be parsed, classifySafety must fail SAFE — flagged: true — so
 * the Mirror is suppressed and crisis handling fires, never silently skipped.
 */

const mockCreate = jest.fn()

jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}))

import { classifySafety } from '@/lib/safety/classifier'

function textResponse(text: string) {
  return { content: [{ type: 'text', text }] }
}

describe('classifySafety — fail-safe on unparseable responses', () => {
  beforeEach(() => mockCreate.mockReset())

  it('fails SAFE (flagged:true) when the response contains no JSON', async () => {
    mockCreate.mockResolvedValue(textResponse('Sorry, I cannot help with that request.'))
    const r = await classifySafety('some user text')
    expect(r.flagged).toBe(true)
    expect(r.flagType).toBe('acute_crisis')
  })

  it('fails SAFE when JSON-like braces are present but the JSON is malformed', async () => {
    mockCreate.mockResolvedValue(textResponse('{flagged: true, confidence: 0.9,}'))
    const r = await classifySafety('some user text')
    expect(r.flagged).toBe(true)
  })

  it('fails SAFE when the model returns an empty completion', async () => {
    mockCreate.mockResolvedValue({ content: [] })
    const r = await classifySafety('some user text')
    expect(r.flagged).toBe(true)
  })

  it('honours a valid flagged:true response', async () => {
    mockCreate.mockResolvedValue(
      textResponse('{"flagged":true,"flagType":"suicidal_ideation","confidence":0.94}'),
    )
    const r = await classifySafety('x')
    expect(r.flagged).toBe(true)
    expect(r.flagType).toBe('suicidal_ideation')
  })

  it('honours a valid flagged:false response (no false crisis for benign input)', async () => {
    mockCreate.mockResolvedValue(
      textResponse('{"flagged":false,"flagType":null,"confidence":0.08}'),
    )
    const r = await classifySafety('x')
    expect(r.flagged).toBe(false)
    expect(r.flagType).toBeNull()
  })
})

import Anthropic from '@anthropic-ai/sdk'
import { SafetyResult, FlagType } from '@/types'

const client = new Anthropic()

const SAFETY_SYSTEM_PROMPT = `You are a safety classifier for Soul Space, an emotional support application. Your job is to detect if user input contains any of these crisis indicators:

MUST FLAG (return flagged: true):
- Suicidal ideation: expressions of wanting to die, end one's life, not exist, "I want to kill myself", "I don't want to be here anymore"
- Self-harm intent: plans or intent to physically harm oneself
- Harm to others: threats or intent to hurt, kill, or harm another person
- Acute crisis: expressions of being in immediate danger, psychiatric emergency, "I can't take it anymore" combined with hopelessness

MUST NOT FLAG (return flagged: false):
- General sadness, grief, or feeling low
- Decision confusion or uncertainty about life choices
- Relationship difficulty or conflict
- Work or career stress
- Feeling overwhelmed by circumstances
- Loneliness or feeling misunderstood
- Anxiety about the future
- Frustration or anger (without harm intent)

Respond ONLY with a JSON object in this exact format:
{
  "flagged": boolean,
  "flagType": "suicidal_ideation" | "self_harm" | "harm_to_others" | "acute_crisis" | null,
  "confidence": number between 0 and 1
}

Do not include any other text. If flagged is false, flagType must be null.`

export async function classifySafety(text: string): Promise<SafetyResult> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 128,
    system: SAFETY_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: text }],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : ''

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found in response')
    const parsed = JSON.parse(jsonMatch[0]) as SafetyResult
    return {
      flagged: Boolean(parsed.flagged),
      flagType: parsed.flagged ? (parsed.flagType as FlagType) : null,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
    }
  } catch {
    // Parse failure: err on the side of caution — do not flag unless clear signal
    return { flagged: false, flagType: null, confidence: 0 }
  }
}

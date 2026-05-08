import Anthropic from '@anthropic-ai/sdk'
import { Branch, Season, MirrorOutput } from '@/types'
import { classifySafety } from '@/lib/safety/classifier'
import { BRANCH_A_PROMPT } from './prompts/branchA'
import { BRANCH_B_PROMPT } from './prompts/branchB'
import { BRANCH_C_PROMPT } from './prompts/branchC'
import { BRANCH_D_PROMPT } from './prompts/branchD'

const client = new Anthropic()

const PROMPT_VERSION = '1.0.0'

const BRANCH_PROMPTS: Record<Branch, string> = {
  A: BRANCH_A_PROMPT,
  B: BRANCH_B_PROMPT,
  C: BRANCH_C_PROMPT,
  D: BRANCH_D_PROMPT,
}

export class SafetyFlagError extends Error {
  constructor(
    public flagType: string | null,
    public confidence: number
  ) {
    super('Safety classifier flagged this input')
    this.name = 'SafetyFlagError'
  }
}

export interface MirrorInput {
  branch: Branch
  emotionTags: string[]
  intensity: number
  contextText: string
}

function assignSeason(
  emotionTags: string[],
  intensity: number,
  branch: Branch
): Season {
  // Winter: high intensity + tags suggesting stuck/heavy/numb
  const winterTags = ['Overwhelmed', 'Stuck', 'Numb', 'Exhausted', 'Resigned', 'Grief']
  const springTags = ['Hopeful', 'Uncertain', 'Anxious']
  const summerTags = ['Relieved']
  const autumnTags = ['Lonely', 'Grief', 'Conflicted']

  const winterScore = emotionTags.filter(t => winterTags.includes(t)).length
  const springScore = emotionTags.filter(t => springTags.includes(t)).length
  const summerScore = emotionTags.filter(t => summerTags.includes(t)).length
  const autumnScore = emotionTags.filter(t => autumnTags.includes(t)).length

  if (intensity >= 8 || winterScore >= 2) return 'W'
  if (intensity >= 5 && (branch === 'C' || branch === 'D')) return 'Au'
  if (summerScore >= 1 && intensity <= 4) return 'Su'
  if (springScore >= 1) return 'Sp'
  if (autumnScore >= 1) return 'Au'
  if (branch === 'A') return 'W'
  if (branch === 'B') return 'Sp'
  if (branch === 'C') return 'Au'
  return 'W'
}

export async function runMirror(input: MirrorInput): Promise<MirrorOutput> {
  // Safety classifier MUST run before every Mirror call — no exceptions
  const safety = await classifySafety(input.contextText)
  if (safety.flagged) {
    throw new SafetyFlagError(safety.flagType, safety.confidence)
  }

  const systemPrompt = BRANCH_PROMPTS[input.branch]
  const userMessage = [
    `Branch: ${input.branch}`,
    `Emotion tags selected: ${input.emotionTags.join(', ')}`,
    `Intensity: ${input.intensity}/10`,
    `What they shared: ${input.contextText}`,
  ].join('\n')

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : ''

  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Mirror did not return valid JSON')

  const parsed = JSON.parse(jsonMatch[0]) as {
    carrying: string
    underneath: string
    question: string
  }

  const season = assignSeason(input.emotionTags, input.intensity, input.branch)

  return {
    carrying: parsed.carrying,
    underneath: parsed.underneath,
    question: parsed.question,
    season,
    patternTags: input.emotionTags.slice(0, 3),
    safetyFlagged: false,
    promptVersion: PROMPT_VERSION,
  }
}

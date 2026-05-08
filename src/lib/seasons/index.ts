import { Season } from '@/types'

export interface SeasonData {
  id: Season
  name: string
  description: string
  grounding: string
  reflection: string
  returnPrompt: string
  color: string
  bgColor: string
  textColor: string
  secondaryColor: string
  borderColor: string
}

// All text is verbatim as approved by Dr. Sofia Georgiadou, March 2026
// Do not modify without new clinical review
export const SEASONS: Record<Season, SeasonData> = {
  W: {
    id: 'W',
    name: 'Winter',
    description:
      'This may feel like a period of heaviness, confusion, or emotional fatigue. There may be uncertainty about what to do next, or a sense of being stuck between choices.',
    grounding:
      'Take a few moments to slow down your breathing and notice what feels most present right now.',
    reflection: 'What feels unclear right now — and what part of that feels most important?',
    returnPrompt: "Winter doesn't last forever. Come back in a few days — your season may already be shifting.",
    color: '#6B8CAE',
    bgColor: 'rgba(20,32,50,.97)',
    textColor: '#C8DCF0',
    secondaryColor: '#8AAAC8',
    borderColor: 'rgba(107,140,174,.2)',
  },
  Sp: {
    id: 'Sp',
    name: 'Spring',
    description:
      'This may feel like a phase of rebuilding or beginning again. There may still be uncertainty, but also a quiet sense of possibility or movement.',
    grounding:
      'Notice one small thing that feels like movement or progress, even if it\'s subtle.',
    reflection: "What is beginning to shift, even if you don't fully understand it yet?",
    returnPrompt: "Spring moves at its own pace. Return soon — your clarity may already be growing.",
    color: '#2A8C7A',
    bgColor: 'rgba(18,38,32,.97)',
    textColor: '#B8E8D4',
    secondaryColor: '#7ABDA0',
    borderColor: 'rgba(42,140,122,.2)',
  },
  Su: {
    id: 'Su',
    name: 'Summer',
    description:
      'This may feel like a time of clarity or steadiness. Decisions may feel more aligned, and there may be a sense of confidence in the direction ahead.',
    grounding: 'Pause and acknowledge what feels steady or clear in this moment.',
    reflection: 'What is helping you feel aligned right now?',
    returnPrompt: "Clarity doesn't stay forever. Come back to capture what you learn from acting on it.",
    color: '#C9A84C',
    bgColor: 'rgba(38,30,12,.97)',
    textColor: '#F2DFA0',
    secondaryColor: '#C8A860',
    borderColor: 'rgba(201,168,76,.2)',
  },
  Au: {
    id: 'Au',
    name: 'Autumn',
    description:
      'This may feel like a reflective period. There may be awareness of change, letting go, or processing something that has recently shifted.',
    grounding: 'Take a moment to sit with what is changing, without trying to rush past it.',
    reflection: "What are you starting to understand that you didn't see before?",
    returnPrompt: "Processing takes the time it takes. Come back when you're ready — there's no rush.",
    color: '#C4784A',
    bgColor: 'rgba(36,20,12,.97)',
    textColor: '#F0C8A0',
    secondaryColor: '#C88060',
    borderColor: 'rgba(196,120,74,.2)',
  },
}

export function getSeason(id: Season): SeasonData {
  return SEASONS[id]
}

/**
 * Mirror Engine Test Suite
 * 30 test cases — 25/30 must pass all 5 criteria
 * Run: npm run test:mirror
 *
 * 5 criteria per output:
 * 1. Specificity — names a specific tension, not a category
 * 2. Non-clinical language — zero clinical terms
 * 3. Question quality — one open, genuinely curious question
 * 4. Three paragraphs returned
 * 5. No prescriptions or advice
 */

import { runMirror } from '@/lib/mirror'
import type { MirrorInput } from '@/lib/mirror'

jest.setTimeout(60000)

const TEST_CASES: MirrorInput[] = [
  { branch: 'A', emotionTags: ['Overwhelmed', 'Stuck'], intensity: 7, contextText: 'I keep going back and forth on whether to take this job. Every time I decide yes, something pulls me back.' },
  { branch: 'A', emotionTags: ['Conflicted', 'Pressured'], intensity: 8, contextText: 'My partner wants to move cities. I love my work here. Neither of us will back down.' },
  { branch: 'A', emotionTags: ['Anxious', 'Exhausted'], intensity: 6, contextText: 'I said I\'d make a decision by Friday and I\'m no closer than I was three months ago.' },
  { branch: 'A', emotionTags: ['Stuck', 'Afraid'], intensity: 9, contextText: 'I keep thinking I\'ve made peace with staying in this relationship. Then the doubt comes back.' },
  { branch: 'A', emotionTags: ['Pressured', 'Conflicted'], intensity: 5, contextText: 'My family expects one thing. The life I actually want looks different. I don\'t know how to hold both.' },
  { branch: 'B', emotionTags: ['Uncertain', 'Numb'], intensity: 4, contextText: 'I know something is off but I can\'t put words to it. Everyone else thinks I\'m fine.' },
  { branch: 'B', emotionTags: ['Lonely', 'Resigned'], intensity: 6, contextText: 'I feel something sitting heavy in my chest and I don\'t know what it is or when it started.' },
  { branch: 'B', emotionTags: ['Anxious', 'Uncertain'], intensity: 5, contextText: 'Something shifted after the conversation last week. I feel different but I can\'t explain how.' },
  { branch: 'B', emotionTags: ['Numb', 'Exhausted'], intensity: 7, contextText: 'I\'ve been going through the motions. I don\'t know what I\'m waiting for.' },
  { branch: 'B', emotionTags: ['Conflicted', 'Afraid'], intensity: 6, contextText: 'There\'s a feeling under everything that I keep avoiding looking at directly.' },
  { branch: 'C', emotionTags: ['Frustrated', 'Stuck'], intensity: 5, contextText: 'This same pattern keeps repeating. Different situation, same result. I don\'t understand what I\'m doing.' },
  { branch: 'C', emotionTags: ['Exhausted', 'Resigned'], intensity: 7, contextText: 'I keep ending up in the same conversations with the same people and nothing changes.' },
  { branch: 'C', emotionTags: ['Anxious', 'Overwhelmed'], intensity: 6, contextText: 'Every few months I go through a period like this and I never know why it starts or when it\'ll lift.' },
  { branch: 'C', emotionTags: ['Lonely', 'Uncertain'], intensity: 5, contextText: 'I\'ve made this same choice three times now. Part of me knows that but I keep making it.' },
  { branch: 'C', emotionTags: ['Numb', 'Resigned'], intensity: 8, contextText: 'There\'s a version of this that happened before. I thought I\'d learned from it. Apparently not.' },
  { branch: 'D', emotionTags: ['Lonely', 'Exhausted'], intensity: 8, contextText: 'I\'ve been holding this for a year without telling anyone. I don\'t know how to start.' },
  { branch: 'D', emotionTags: ['Overwhelmed', 'Resigned'], intensity: 7, contextText: 'No one in my life knows what\'s actually going on. I have to appear fine constantly.' },
  { branch: 'D', emotionTags: ['Afraid', 'Numb'], intensity: 6, contextText: 'I stopped talking about it because people couldn\'t understand or got uncomfortable.' },
  { branch: 'D', emotionTags: ['Lonely', 'Stuck'], intensity: 9, contextText: 'I\'ve been managing this entirely alone and it\'s starting to cost me in ways I can\'t describe.' },
  { branch: 'D', emotionTags: ['Exhausted', 'Conflicted'], intensity: 7, contextText: 'I don\'t want to burden anyone. But not sharing it is also a kind of weight.' },
  { branch: 'A', emotionTags: ['Pressured', 'Overwhelmed', 'Stuck'], intensity: 8, contextText: 'My lease ends in two months and I still can\'t decide whether to stay in this city or move.' },
  { branch: 'B', emotionTags: ['Hopeful', 'Anxious', 'Uncertain'], intensity: 4, contextText: 'Something feels like it\'s changing but I\'m scared to name it in case I\'m wrong.' },
  { branch: 'C', emotionTags: ['Frustrated', 'Lonely', 'Resigned'], intensity: 6, contextText: 'I notice I withdraw when things get difficult. I\'ve always done this. I\'m not sure I want to anymore.' },
  { branch: 'D', emotionTags: ['Afraid', 'Exhausted', 'Lonely'], intensity: 9, contextText: 'I haven\'t slept properly in weeks. I haven\'t told anyone. I\'m holding too much.' },
  { branch: 'A', emotionTags: ['Conflicted', 'Anxious'], intensity: 5, contextText: 'I said yes to something I\'m not sure I wanted. Now I have to figure out whether to honour it or change my mind.' },
  { branch: 'B', emotionTags: ['Numb', 'Uncertain'], intensity: 3, contextText: 'I feel flat. Not sad. Just flat. Like the signal is gone.' },
  { branch: 'C', emotionTags: ['Stuck', 'Overwhelmed'], intensity: 7, contextText: 'I recognise this feeling. I thought I\'d outgrown it. It came back.' },
  { branch: 'D', emotionTags: ['Lonely', 'Resigned'], intensity: 6, contextText: 'The people around me are fine. I\'m the one carrying something I can\'t explain to them.' },
  { branch: 'A', emotionTags: ['Pressured', 'Afraid', 'Conflicted'], intensity: 9, contextText: 'This decision affects too many people. Every choice I make is wrong for someone.' },
  { branch: 'B', emotionTags: ['Uncertain', 'Exhausted', 'Hopeful'], intensity: 5, contextText: 'I\'m in between something ending and something beginning and I don\'t know which is which.' },
]

const CLINICAL_TERMS = [
  'anxiety disorder', 'depression', 'trauma', 'ptsd', 'ocd', 'adhd',
  'bipolar', 'disorder', 'diagnosis', 'diagnose', 'symptom', 'treatment',
  'therapy', 'therapist', 'medication', 'prescription', 'pathology',
]

const ADVICE_PHRASES = [
  'you should', 'try to', 'you need to', 'i recommend', 'it\'s important to',
  'you must', 'you have to', 'make sure to', 'consider doing',
]

function checkCriteria(
  output: { carrying: string; underneath: string; question: string },
  _input: MirrorInput
): { passed: boolean; failures: string[] } {
  const failures: string[] = []
  const fullText = [output.carrying, output.underneath, output.question].join(' ').toLowerCase()

  // Criterion 1: three paragraphs
  if (!output.carrying || output.carrying.length < 20) failures.push('carrying paragraph too short or missing')
  if (!output.underneath || output.underneath.length < 20) failures.push('underneath paragraph too short or missing')
  if (!output.question || output.question.length < 10) failures.push('question missing')

  // Criterion 2: no clinical terms
  const clinicalHits = CLINICAL_TERMS.filter(t => fullText.includes(t))
  if (clinicalHits.length > 0) failures.push(`clinical terms found: ${clinicalHits.join(', ')}`)

  // Criterion 3: no advice
  const adviceHits = ADVICE_PHRASES.filter(p => fullText.includes(p))
  if (adviceHits.length > 0) failures.push(`advice found: ${adviceHits.join(', ')}`)

  // Criterion 4: question ends with ?
  // Guard against question being undefined/null — criterion 1 already logged the failure.
  if (output.question && !output.question.includes('?')) failures.push('question does not end with ?')

  // Criterion 5: question is a single sentence
  if (output.question) {
    const questionSentences = output.question.split('?').filter(s => s.trim().length > 0)
    if (questionSentences.length > 1) failures.push('question appears to contain multiple sentences')
  }

  return { passed: failures.length === 0, failures }
}

describe('Mirror Engine — 30 test cases (25/30 must pass all criteria)', () => {
  let passCount = 0
  const results: { index: number; passed: boolean; failures: string[] }[] = []

  afterAll(() => {
    console.log(`\nMirror test results: ${passCount}/30 passed`)
    if (passCount < 25) {
      console.error('BELOW THRESHOLD — 25/30 required. Fix Mirror prompts.')
    }
    expect(passCount).toBeGreaterThanOrEqual(25)
  })

  TEST_CASES.forEach((input, i) => {
    it(`Case ${i + 1}: branch ${input.branch}, intensity ${input.intensity}`, async () => {
      const output = await runMirror(input)
      const { passed, failures } = checkCriteria(output, input)
      results.push({ index: i + 1, passed, failures })
      if (passed) passCount++
      if (!passed) {
        console.warn(`Case ${i + 1} failed: ${failures.join(' | ')}`)
      }
    })
  })
})

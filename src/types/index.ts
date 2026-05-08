export type Branch = 'A' | 'B' | 'C' | 'D'
export type Season = 'W' | 'Sp' | 'Su' | 'Au'
export type ResonanceTap = 'accurate' | 'not_quite'
export type FlagType = 'suicidal_ideation' | 'self_harm' | 'harm_to_others' | 'acute_crisis'

export interface SafetyResult {
  flagged: boolean
  flagType: FlagType | null
  confidence: number
}

export interface MirrorOutput {
  carrying: string
  underneath: string
  question: string
  season: Season
  patternTags: string[]
  safetyFlagged: boolean
  promptVersion: string
}

export interface SessionState {
  sessionId?: string
  branch?: Branch
  emotionTags: string[]
  intensity?: number
  contextText?: string
  mirrorOutput?: MirrorOutput
  resonanceTap?: ResonanceTap
  safetyFlagged: boolean
}

export interface EventPayload {
  sessionId: string
  eventName: string
  properties?: Record<string, unknown>
}

export type EventName =
  | 'session_start'
  | 'branch_selected'
  | 'emotions_submitted'
  | 'intensity_submitted'
  | 'context_submitted'
  | 'mirror_rendered'
  | 'resonance_tapped'
  | 'season_shown'
  | 'nextstep_selected'
  | 'session_complete'
  | 'safety_event'
  | 'session_drop'

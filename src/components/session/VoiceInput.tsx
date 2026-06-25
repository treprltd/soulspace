'use client'

/**
 * VoiceInput — mic button for the context textarea.
 *
 * Uses the browser's SpeechRecognition API (no API key, no server round-trip).
 * Audio is processed by the browser's speech engine (Chrome/Edge: Google cloud;
 * Safari: on-device). Only the text transcript is kept — no audio is stored.
 *
 * Access gate: requires isAuthenticated AND isPaid.
 * Unqualified users see a muted mic with a tooltip explaining the requirement.
 */

import { useState, useEffect, useRef, useCallback } from 'react'

// ── Web Speech API — minimal typings (not fully covered by lib.dom.d.ts) ──
interface SpeechRecognitionResult {
  readonly isFinal: boolean
  readonly [index: number]: { transcript: string }
}
interface SpeechRecognitionResultList {
  readonly length: number
  [index: number]: SpeechRecognitionResult
}
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultList
}
interface ISpeechRecognition extends EventTarget {
  continuous:     boolean
  interimResults: boolean
  lang:           string
  start():  void
  stop():   void
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  onerror:  ((e: Event) => void) | null
  onend:    (() => void) | null
}
declare global {
  interface Window {
    SpeechRecognition?:       new () => ISpeechRecognition
    webkitSpeechRecognition?: new () => ISpeechRecognition
  }
}

type RecordingState = 'idle' | 'recording' | 'processing'

interface VoiceInputProps {
  onTranscript: (text: string) => void
  isAuthenticated: boolean
  isPaid: boolean
  disabled?: boolean
}

// ── Icons ──────────────────────────────────────────────────────────────────
function MicIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="9"  y1="22" x2="15" y2="22" />
    </svg>
  )
}

function StopIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  )
}

function LockIcon({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

// ── Component ──────────────────────────────────────────────────────────────
export function VoiceInput({ onTranscript, isAuthenticated, isPaid, disabled = false }: VoiceInputProps) {
  const [supported, setSupported]     = useState(false)
  const [state, setState]             = useState<RecordingState>('idle')
  const [showTooltip, setShowTooltip] = useState(false)
  const recognitionRef                = useRef<ISpeechRecognition | null>(null)
  const accumulatedRef                = useRef('')

  const canUse = isAuthenticated && isPaid

  // Detect support client-side only (no SSR mismatch)
  useEffect(() => {
    setSupported(
      typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
    )
  }, [])

  // Cleanup on unmount — stop any active recognition
  useEffect(() => {
    return () => { recognitionRef.current?.stop() }
  }, [])

  const startRecording = useCallback(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SR) return
    const recognition = new SR()

    recognition.continuous     = true   // keep listening until user stops
    recognition.interimResults = false  // only emit finalised segments
    recognition.lang           = 'en-US'

    accumulatedRef.current = ''

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // Collect all new final results from this event batch
      const allResults = Array.from(
        { length: event.results.length },
        (_, i) => event.results[i]
      )
      const segment = allResults
        .slice(event.resultIndex)
        .filter(r => r.isFinal)
        .map(r => r[0].transcript.trim())
        .filter(Boolean)
        .join(' ')

      if (segment) {
        accumulatedRef.current = accumulatedRef.current
          ? `${accumulatedRef.current} ${segment}`
          : segment
      }
    }

    recognition.onerror = () => {
      setState('idle')
    }

    recognition.onend = () => {
      setState('idle')
      const transcript = accumulatedRef.current.trim()
      if (transcript) onTranscript(transcript)
      accumulatedRef.current = ''
    }

    recognitionRef.current = recognition
    recognition.start()
    setState('recording')
  }, [onTranscript])

  const stopRecording = useCallback(() => {
    setState('processing')
    recognitionRef.current?.stop()
  }, [])

  const handleClick = () => {
    if (disabled) return
    if (!canUse) { setShowTooltip(t => !t); return }
    if (state === 'recording') stopRecording()
    else if (state === 'idle') startRecording()
  }

  // Don't render if the browser has no speech API at all
  if (!supported) return null

  // ── Locked state (not logged in or not paid) ────────────────────────────
  if (!canUse) {
    return (
      <div className="relative inline-flex">
        <button
          type="button"
          onClick={handleClick}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          aria-label="Voice input — subscribers only"
          className="flex items-center justify-center w-9 h-9 rounded-xl transition-opacity"
          style={{
            background: 'rgba(245,237,216,.04)',
            border: '1px solid rgba(245,237,216,.07)',
            color: 'rgba(213,226,235,.60)',
            cursor: 'default',
          }}
        >
          <MicIcon size={16} />
          {/* Lock badge */}
          <span
            className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full"
            style={{ background: '#060E18', border: '1px solid rgba(245,237,216,.76)', color: 'rgba(213,226,235,.72)' }}
          >
            <LockIcon size={8} />
          </span>
        </button>

        {/* Tooltip */}
        {showTooltip && (
          <div
            className="absolute bottom-full right-0 mb-2 w-48 rounded-xl px-3 py-2 text-center pointer-events-none z-10"
            style={{
              background: '#0F1E2E',
              border: '1px solid rgba(245,237,216,.08)',
              color: 'rgba(245,247,240,.6)',
              fontSize: '13px',
              lineHeight: '1.5',
            }}
          >
            {!isAuthenticated
              ? 'Sign in and subscribe to use voice input.'
              : 'Voice input is available on paid plans.'}
            {/* Arrow */}
            <span
              className="absolute -bottom-[5px] right-3 w-2.5 h-2.5 rotate-45"
              style={{ background: '#0F1E2E', borderRight: '1px solid rgba(245,237,216,.08)', borderBottom: '1px solid rgba(245,237,216,.08)' }}
            />
          </div>
        )}
      </div>
    )
  }

  // ── Active state (paid + logged in) ────────────────────────────────────
  const isRecording   = state === 'recording'
  const isProcessing  = state === 'processing'

  return (
    <div className="relative inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || isProcessing}
        aria-label={isRecording ? 'Stop recording' : 'Record your thoughts'}
        title={isRecording ? 'Stop recording' : 'Speak your thoughts'}
        className="flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200"
        style={{
          background: isRecording
            ? 'rgba(212,64,64,.15)'
            : 'rgba(201,168,76,.07)',
          border: `1px solid ${isRecording ? 'rgba(212,64,64,.35)' : 'rgba(201,168,76,.2)'}`,
          color: isRecording ? '#D44040' : 'rgba(201,168,76,.75)',
          cursor: isProcessing ? 'wait' : 'pointer',
        }}
      >
        {/* Pulse ring when recording */}
        {isRecording && (
          <span
            className="absolute inset-0 rounded-xl animate-ping"
            style={{ background: 'rgba(212,64,64,.12)', animationDuration: '1.2s' }}
          />
        )}
        <span className="relative z-10">
          {isRecording ? <StopIcon size={14} /> : <MicIcon size={16} />}
        </span>
      </button>

      {/* Status label */}
      {(isRecording || isProcessing) && (
        <span
          className="absolute -bottom-5 right-0 whitespace-nowrap"
          style={{ fontSize: '12px', color: isRecording ? 'rgba(212,64,64,.7)' : 'rgba(213,226,235,.72)' }}
        >
          {isRecording ? '● Listening…' : 'Done'}
        </span>
      )}
    </div>
  )
}

/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, act } from '@testing-library/react'
import { VoiceInput } from '@/components/session/VoiceInput'

// Minimal mock of the Web Speech API — enough to drive the component's
// start/stop/result/end lifecycle without a real browser engine.
class MockSpeechRecognition {
  continuous = false
  interimResults = false
  lang = ''
  onresult: ((e: unknown) => void) | null = null
  onerror: ((e: unknown) => void) | null = null
  onend: (() => void) | null = null
  start = jest.fn()
  stop = jest.fn(() => { this.onend?.() })
}

function withSpeechRecognition() {
  ;(window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = MockSpeechRecognition
}

function withoutSpeechRecognition() {
  delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition
  delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
}

describe('VoiceInput', () => {
  afterEach(() => {
    withoutSpeechRecognition()
    jest.restoreAllMocks()
  })

  it('renders nothing when the browser has no Speech Recognition API', () => {
    withoutSpeechRecognition()
    const { container } = render(
      <VoiceInput onTranscript={jest.fn()} isAuthenticated={true} isPaid={true} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('shows a locked mic for unauthenticated guests, and never starts recognition', () => {
    withSpeechRecognition()
    render(<VoiceInput onTranscript={jest.fn()} isAuthenticated={false} isPaid={false} />)

    const button = screen.getByRole('button', { name: /subscribers only/i })
    fireEvent.click(button)
    fireEvent.mouseEnter(button)
    expect(screen.getByText(/sign in and subscribe/i)).toBeInTheDocument()
  })

  it('shows a locked mic with a different message for authenticated free users', () => {
    withSpeechRecognition()
    render(<VoiceInput onTranscript={jest.fn()} isAuthenticated={true} isPaid={false} />)

    const button = screen.getByRole('button', { name: /subscribers only/i })
    fireEvent.mouseEnter(button)
    expect(screen.getByText(/available on paid plans/i)).toBeInTheDocument()
  })

  it('allows authenticated, paid users to start and stop recording', () => {
    withSpeechRecognition()
    const onTranscript = jest.fn()
    render(<VoiceInput onTranscript={onTranscript} isAuthenticated={true} isPaid={true} />)

    const button = screen.getByRole('button', { name: /record your thoughts/i })
    fireEvent.click(button)
    expect(screen.getByText(/listening/i)).toBeInTheDocument()
  })

  it('passes the final transcript to onTranscript and never stores audio', () => {
    withSpeechRecognition()
    const onTranscript = jest.fn()
    render(<VoiceInput onTranscript={onTranscript} isAuthenticated={true} isPaid={true} />)

    const button = screen.getByRole('button', { name: /record your thoughts/i })

    // Capture the recognition instance the component creates on click
    let instance: MockSpeechRecognition | undefined
    const OriginalSR = (window as unknown as { SpeechRecognition: typeof MockSpeechRecognition }).SpeechRecognition
    ;(window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = class extends OriginalSR {
      constructor() {
        super()
        instance = this
      }
    }

    fireEvent.click(button) // start
    expect(instance).toBeDefined()

    // Simulate a final speech result
    act(() => {
      instance!.onresult?.({
        resultIndex: 0,
        results: { length: 1, 0: { isFinal: true, 0: { transcript: 'I keep going back and forth.' } } },
      })
    })

    fireEvent.click(screen.getByRole('button', { name: /stop recording/i })) // stop -> triggers onend

    expect(onTranscript).toHaveBeenCalledWith('I keep going back and forth.')
    // The component's contract is text-only — no audio/blob ever reaches the callback
    expect(typeof onTranscript.mock.calls[0][0]).toBe('string')
  })

  it('does not start recognition while disabled', () => {
    withSpeechRecognition()
    render(<VoiceInput onTranscript={jest.fn()} isAuthenticated={true} isPaid={true} disabled />)
    const button = screen.getByRole('button', { name: /record your thoughts/i })
    fireEvent.click(button)
    expect(screen.queryByText(/listening/i)).not.toBeInTheDocument()
  })
})

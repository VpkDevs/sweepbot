/**
 * Voice recorder — wraps the Web Speech API (SpeechRecognition).
 * Returns a promise that resolves with the final transcript.
 * Available natively in Chrome; no API keys required.
 */

// Web Speech API type declarations (available in Chrome but not in standard TS lib)
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string
  readonly message: string
}

interface SpeechRecognition extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null
  onend: ((this: SpeechRecognition, ev: Event) => void) | null
  start(): void
  stop(): void
  abort(): void
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition
}

export type RecordingState = 'idle' | 'listening' | 'processing' | 'error'

export interface VoiceRecorderOptions {
  /** BCP-47 language tag, e.g. 'en-US' */
  lang?: string
  /** Max silence before auto-stop (ms). Default: 3000 */
  silenceTimeout?: number
  onInterim?: (text: string) => void
  onStateChange?: (state: RecordingState) => void
}

export class VoiceRecorder {
  private recognition: SpeechRecognition | null = null
  private finalTranscript = ''
  private silenceTimer: ReturnType<typeof setTimeout> | null = null
  private options: Required<VoiceRecorderOptions>

  constructor(options: VoiceRecorderOptions = {}) {
    this.options = {
      lang: options.lang ?? 'en-US',
      silenceTimeout: options.silenceTimeout ?? 3000,
      onInterim: options.onInterim ?? (() => {}),
      onStateChange: options.onStateChange ?? (() => {}),
    }
  }

  /** Returns true if SpeechRecognition is available in this browser */
  static isSupported(): boolean {
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
  }

  /**
   * Start recording. Returns a promise that resolves with the final transcript
   * when the user stops speaking (or rejects on error / permission denied).
   * Rejects if already recording to prevent concurrent instances.
   */
  record(): Promise<string> {
    if (this.recognition) {
      return Promise.reject(new Error('Already recording. Call stop() first.'))
    }

    if (!VoiceRecorder.isSupported()) {
      return Promise.reject(new Error('SpeechRecognition is not supported in this browser.'))
    }

    const SR =
      (window as unknown as { SpeechRecognition: SpeechRecognitionConstructor })
        .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition: SpeechRecognitionConstructor })
        .webkitSpeechRecognition

    const recognition = new SR()
    this.recognition = recognition
    recognition.lang = this.options.lang
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    this.finalTranscript = ''

    return new Promise<string>((resolve, reject) => {
      recognition.onstart = () => {
        this.options.onStateChange('listening')
      }

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interimTranscript = ''

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          if (result.isFinal) {
            this.finalTranscript += result[0]?.transcript + ' '
          } else {
            interimTranscript += result[0]?.transcript
          }
        }

        this.options.onInterim(this.finalTranscript + interimTranscript)

        // Reset silence timer on any speech
        this.resetSilenceTimer()
      }

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        this.cleanup()
        if (event.error === 'no-speech') {
          reject(new Error('No speech detected. Try again.'))
        } else if (event.error === 'not-allowed') {
          reject(
            new Error('Microphone permission denied. Please allow microphone access and try again.')
          )
        } else {
          reject(new Error(`Speech recognition error: ${event.error}`))
        }
        this.options.onStateChange('error')
      }

      recognition.onend = () => {
        if (this.finalTranscript.trim()) {
          this.options.onStateChange('processing')
          resolve(this.finalTranscript.trim())
        } else {
          this.options.onStateChange('idle')
          reject(new Error('No speech captured. Please try again.'))
        }
        this.cleanup()
      }

      recognition.start()
      this.resetSilenceTimer()
    })
  }

  /** Manually stop recording */
  stop(): void {
    this.recognition?.stop()
    this.cleanup()
  }

  /** Immediately kill the recording without processing or resolving results */
  abort(): void {
    if (this.recognition) {
      this.recognition.onend = null // suppress onend callback
      this.recognition.onerror = null
      this.recognition.onresult = null
      this.recognition.abort()
    }
    this.cleanup()
  }

  private resetSilenceTimer(): void {
    if (this.silenceTimer) clearTimeout(this.silenceTimer)
    this.silenceTimer = setTimeout(() => {
      this.recognition?.stop()
    }, this.options.silenceTimeout)
  }

  private cleanup(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer)
      this.silenceTimer = null
    }
    this.recognition = null
  }
}

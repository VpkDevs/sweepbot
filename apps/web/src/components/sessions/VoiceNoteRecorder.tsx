import { useState } from 'react'
import { Mic, MicOff, Save, X, Loader2, PenLine } from 'lucide-react'
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition'
import { api } from '../../lib/api'
import { cn } from '../../lib/utils'

type RecorderState = 'idle' | 'recording' | 'saving'

interface Props {
  sessionId: string
  onNoteAdded: () => void
}

/**
 * Records a voice note (or falls back to text input) for a session.
 * Cycles through: idle → recording → saving states.
 */
export function VoiceNoteRecorder({ sessionId, onNoteAdded }: Props) {
  const { isListening, transcript, isSupported, error, startListening, stopListening, resetTranscript } =
    useSpeechRecognition()

  const [state, setState] = useState<RecorderState>('idle')
  const [textFallback, setTextFallback] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)

  const activeTranscript = isSupported ? transcript : textFallback

  const handleStart = () => {
    resetTranscript()
    setSaveError(null)
    setState('recording')
    if (isSupported) startListening()
  }

  const handleCancel = () => {
    if (isListening) stopListening()
    resetTranscript()
    setTextFallback('')
    setSaveError(null)
    setState('idle')
  }

  const handleSave = async () => {
    const content = activeTranscript.trim()
    if (!content) return
    if (isListening) stopListening()
    setState('saving')
    setSaveError(null)
    try {
      await api.sessionNotes.create(sessionId, {
        content,
        noteType: isSupported ? 'voice' : 'text',
      })
      resetTranscript()
      setTextFallback('')
      setState('idle')
      onNoteAdded()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save note')
      setState('recording')
    }
  }

  // ── Idle ──────────────────────────────────────────────────────────────────
  if (state === 'idle') {
    return (
      <div className="space-y-1">
        {!isSupported && (
          <p className="text-xs text-zinc-500 mb-2">
            Voice recording not supported in this browser. You can type a note instead.
          </p>
        )}
        <button
          type="button"
          onClick={handleStart}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-zinc-300 glass-card hover:bg-white/[0.06] transition-all press-scale"
        >
          {isSupported ? <Mic className="w-3.5 h-3.5 text-brand-400" /> : <PenLine className="w-3.5 h-3.5 text-brand-400" />}
          {isSupported ? '🎤 Add Note' : 'Add Text Note'}
        </button>
      </div>
    )
  }

  // ── Saving ────────────────────────────────────────────────────────────────
  if (state === 'saving') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-xs text-zinc-400">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-400" />
        Saving note…
      </div>
    )
  }

  // ── Recording ─────────────────────────────────────────────────────────────
  // Fixed bar heights so the pattern is stable across renders
  const WAVEFORM_HEIGHTS = [40, 70, 55, 90, 35, 80, 50, 75, 30, 85, 45, 65]
  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  return (
    <div className="glass-card rounded-2xl p-4 space-y-3 animate-fade-in">
      {/* Waveform animation (CSS) */}
      {isSupported && isListening && (
        <div className="flex items-center gap-0.5 h-6" aria-label="Recording in progress">
          {WAVEFORM_HEIGHTS.map((h, i) => (
            <div
              key={i}
              className="w-1 rounded-full bg-brand-400 opacity-80"
              style={{
                height: `${h}%`,
                animation: prefersReducedMotion
                  ? undefined
                  : `waveform 0.8s ease-in-out ${i * 0.07}s infinite alternate`,
              }}
            />
          ))}
          <span className="ml-2 text-[10px] text-brand-400 font-semibold uppercase tracking-widest animate-pulse">
            Recording
          </span>
        </div>
      )}

      {/* Live transcript / text input */}
      {isSupported ? (
        <p className={cn('text-sm min-h-[40px] text-zinc-300 leading-relaxed', !transcript && 'text-zinc-600 italic')}>
          {transcript || 'Start speaking…'}
        </p>
      ) : (
        <textarea
          className="w-full bg-transparent text-sm text-zinc-300 placeholder-zinc-600 resize-none outline-none min-h-[60px]"
          placeholder="Type your note…"
          value={textFallback}
          onChange={(e) => setTextFallback(e.target.value)}
          autoFocus
        />
      )}

      {(error ?? saveError) && (
        <p className="text-xs text-red-400">{error ?? saveError}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!activeTranscript.trim()}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all press-scale',
            'bg-brand-500/20 text-brand-300 ring-1 ring-brand-500/30 hover:bg-brand-500/30',
            !activeTranscript.trim() && 'opacity-40 cursor-not-allowed',
          )}
        >
          <Save className="w-3.5 h-3.5" />
          Stop & Save
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          Cancel
        </button>
        {isSupported && (
          <div className="ml-auto flex items-center gap-1 text-[10px] text-zinc-600">
            <MicOff className="w-3 h-3" />
            {isListening ? 'Live' : 'Paused'}
          </div>
        )}
      </div>
    </div>
  )
}

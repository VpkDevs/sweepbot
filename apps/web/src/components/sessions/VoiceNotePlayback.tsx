import { useQuery } from '@tanstack/react-query'
import { Mic, PenLine } from 'lucide-react'
import { api } from '../../lib/api'
import { cn } from '../../lib/utils'

interface SessionNote {
  id: string
  content: string
  noteType: string
  createdAt: string
}

interface Props {
  sessionId: string
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

/**
 * Displays all notes for a session with type badges and timestamps.
 */
export function VoiceNotePlayback({ sessionId }: Props) {
  const { data: rawNotes, isLoading } = useQuery({
    queryKey: ['session-notes', sessionId],
    queryFn: () => api.sessionNotes.list(sessionId) as unknown as Promise<SessionNote[]>,
    enabled: Boolean(sessionId),
  })

  const notes = rawNotes ?? []

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-12 rounded-xl shimmer" />
        ))}
      </div>
    )
  }

  if (notes.length === 0) {
    return (
      <p className="text-xs text-zinc-600 italic py-2">No notes for this session</p>
    )
  }

  return (
    <ul className="space-y-2">
      {notes.map((note) => {
        const isVoice = note.noteType === 'voice'
        return (
          <li
            key={note.id}
            className={cn(
              'flex items-start gap-3 rounded-xl px-3 py-2.5 text-sm',
              'bg-white/[0.03] ring-1 ring-white/[0.05]',
              'animate-fade-in',
            )}
          >
            {/* Type badge */}
            <span
              className={cn(
                'mt-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md flex-shrink-0',
                isVoice
                  ? 'bg-brand-500/15 text-brand-400 ring-1 ring-brand-500/20'
                  : 'bg-zinc-700/50 text-zinc-400 ring-1 ring-zinc-600/20',
              )}
            >
              {isVoice ? <Mic className="w-2.5 h-2.5" /> : <PenLine className="w-2.5 h-2.5" />}
              {isVoice ? 'voice' : 'text'}
            </span>

            {/* Content */}
            <span className="flex-1 text-zinc-300 leading-relaxed">{note.content}</span>

            {/* Time */}
            <span className="text-[10px] text-zinc-600 flex-shrink-0 mt-0.5">
              {formatTime(note.createdAt)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

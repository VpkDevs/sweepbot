/**
 * Voice Notes Processor
 * Keyword-based transcript analysis and session note persistence.
 */

import { sql } from 'drizzle-orm'
import { query } from '../db/client.js'

export interface TranscriptAnalysis {
  sentiment: 'positive' | 'neutral' | 'negative' | 'frustrated' | 'excited'
  tags: string[]
  mentionedGames: string[]
}

export interface SessionNote {
  id: string
  session_id: string
  user_id: string
  content: string
  note_type: 'text' | 'voice' | 'image'
  audio_url: string | null
  audio_duration: number | null
  transcription_confidence: string | null
  created_at: string
  updated_at: string
}

// Keyword lists for sentiment classification (checked in priority order)
const EXCITED_WORDS = ['incredible', 'unbelievable', 'wow'] as const
const FRUSTRATED_WORDS = ["can't", 'stuck', 'ugh', 'why'] as const
const POSITIVE_WORDS = ['big win', 'jackpot', 'amazing', 'great', 'love', 'nice'] as const
const NEGATIVE_WORDS = ['lost', 'terrible', 'frustrating', 'bad', 'hate', 'tilt'] as const

const GAME_TYPES = [
  'slots',
  'poker',
  'blackjack',
  'roulette',
  'baccarat',
  'keno',
  'bingo',
  'craps',
  'video poker',
] as const

export class VoiceNotesProcessor {
  /**
   * Analyses a transcript string using keyword matching.
   * Returns sentiment classification, relevant tags, and mentioned game types.
   */
  analyzeTranscript(transcript: string): TranscriptAnalysis {
    const lower = transcript.toLowerCase()

    let sentiment: TranscriptAnalysis['sentiment'] = 'neutral'
    if (EXCITED_WORDS.some((w) => lower.includes(w))) {
      sentiment = 'excited'
    } else if (FRUSTRATED_WORDS.some((w) => lower.includes(w))) {
      sentiment = 'frustrated'
    } else if (POSITIVE_WORDS.some((w) => lower.includes(w))) {
      sentiment = 'positive'
    } else if (NEGATIVE_WORDS.some((w) => lower.includes(w))) {
      sentiment = 'negative'
    }

    const tags: string[] = []
    if (lower.includes('bonus')) tags.push('bonus')
    if (lower.includes('jackpot')) tags.push('jackpot')
    if (lower.includes('tilt')) tags.push('tilt')
    if (lower.includes('strategy')) tags.push('strategy')
    if (lower.includes('big win')) tags.push('big_win')

    const mentionedGames = GAME_TYPES.filter((g) => lower.includes(g))

    return { sentiment, tags, mentionedGames }
  }

  /**
   * Persists a session note (text or voice) to the database.
   * For voice notes, runs transcript analysis (but the analysis is not stored separately —
   * it is available in the return value via a second pass if needed).
   */
  async saveNote(
    sessionId: string,
    userId: string,
    content: string,
    noteType: 'text' | 'voice',
    audioUrl?: string,
    audioDuration?: number
  ): Promise<SessionNote> {
    const { rows } = await query<SessionNote>(sql`
      INSERT INTO session_notes (session_id, user_id, content, note_type, audio_url, audio_duration)
      VALUES (${sessionId}, ${userId}, ${content}, ${noteType}, ${audioUrl ?? null}, ${audioDuration ?? null})
      RETURNING
        id, session_id, user_id, content, note_type, audio_url, audio_duration,
        transcription_confidence, created_at, updated_at
    `)

    if (!rows[0]) {
      throw new Error('Failed to insert session note')
    }
    return rows[0]
  }

  /**
   * Returns all notes for a session, ordered by created_at ascending (chronological).
   * Scoped to the given userId to prevent cross-user reads.
   */
  async getSessionNotes(sessionId: string, userId: string): Promise<SessionNote[]> {
    const { rows } = await query<SessionNote>(sql`
      SELECT
        id, session_id, user_id, content, note_type, audio_url, audio_duration,
        transcription_confidence, created_at, updated_at
      FROM session_notes
      WHERE session_id = ${sessionId} AND user_id = ${userId}
      ORDER BY created_at ASC
    `)
    return rows
  }
}

export const voiceNotesProcessor = new VoiceNotesProcessor()

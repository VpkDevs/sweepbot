/**
 * Session Notes API Routes
 * Text and voice annotations attached to gaming sessions
 * Prefix: /session-notes
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { sql } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth.js'
import { query } from '../db/client.js'

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const sessionNoteParamsSchema = z.object({ id: z.string().uuid() })
const sessionParamsSchema = z.object({ sessionId: z.string().uuid() })

const createNoteSchema = z.object({
  sessionId: z.string().uuid(),
  content: z.string().min(1),
  noteType: z.enum(['text', 'voice', 'image']).default('text'),
  audioUrl: z.string().url().optional(),
  audioDuration: z.number().int().positive().optional(),
})

// ─── DB row shape ─────────────────────────────────────────────────────────────

interface NoteRow {
  id: string
  session_id: string
  user_id: string
  content: string
  note_type: string
  audio_url: string | null
  audio_duration: number | null
  transcription_confidence: string | null
  created_at: string
  updated_at: string
}

function mapNoteRow(row: NoteRow) {
  return {
    id: row.id,
    sessionId: row.session_id,
    userId: row.user_id,
    content: row.content,
    noteType: row.note_type,
    audioUrl: row.audio_url,
    audioDuration: row.audio_duration,
    transcriptionConfidence: row.transcription_confidence,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ─── Route registration ───────────────────────────────────────────────────────

export async function sessionNotesRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preValidation', requireAuth)

  // ── GET /session-notes/by-session/:sessionId ──────────────────────────────
  // Returns all notes for a session (must belong to the authed user).
  app.get<{ Params: { sessionId: string } }>(
    '/by-session/:sessionId',
    {
      schema: {
        params: sessionParamsSchema,
        tags: ['Session Notes'],
        summary: 'List notes for a session',
      },
    },
    async (request, reply) => {
      try {
        const { sessionId } = request.params
        const userId = request.user!.id

        const { rows } = await query<NoteRow>(sql`
          SELECT
            id, session_id, user_id, content, note_type,
            audio_url, audio_duration, transcription_confidence,
            created_at, updated_at
          FROM session_notes
          WHERE session_id = ${sessionId}
            AND user_id = ${userId}
          ORDER BY created_at ASC
        `)

        return reply.send({ success: true, data: rows.map(mapNoteRow) })
      } catch (error) {
        app.log.error({ error }, 'GET /session-notes/by-session error')
        return reply.code(500).send({
          error: 'INTERNAL_ERROR',
          message: 'Failed to fetch session notes',
          status: 500,
        })
      }
    },
  )

  // ── POST /session-notes ───────────────────────────────────────────────────
  // Create a new note for a session.
  app.post(
    '/',
    {
      schema: {
        tags: ['Session Notes'],
        summary: 'Create a session note',
      },
    },
    async (request, reply) => {
      try {
        const userId = request.user!.id
        const body = createNoteSchema.parse(request.body)

        const { rows } = await query<NoteRow>(sql`
          INSERT INTO session_notes (session_id, user_id, content, note_type, audio_url, audio_duration)
          VALUES (
            ${body.sessionId},
            ${userId},
            ${body.content},
            ${body.noteType},
            ${body.audioUrl ?? null},
            ${body.audioDuration ?? null}
          )
          RETURNING
            id, session_id, user_id, content, note_type,
            audio_url, audio_duration, transcription_confidence,
            created_at, updated_at
        `)

        return reply.code(201).send({ success: true, data: mapNoteRow(rows[0]!) })
      } catch (error) {
        app.log.error({ error }, 'POST /session-notes error')
        return reply.code(500).send({
          error: 'INTERNAL_ERROR',
          message: 'Failed to create session note',
          status: 500,
        })
      }
    },
  )

  // ── DELETE /session-notes/:id ─────────────────────────────────────────────
  // Delete a note (owner-only).
  app.delete<{ Params: { id: string } }>(
    '/:id',
    {
      schema: {
        params: sessionNoteParamsSchema,
        tags: ['Session Notes'],
        summary: 'Delete a session note',
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params
        const userId = request.user!.id

        await query(sql`
          DELETE FROM session_notes
          WHERE id = ${id} AND user_id = ${userId}
        `)

        return reply.send({ success: true, data: { deleted: true } })
      } catch (error) {
        app.log.error({ error }, 'DELETE /session-notes/:id error')
        return reply.code(500).send({
          error: 'INTERNAL_ERROR',
          message: 'Failed to delete session note',
          status: 500,
        })
      }
    },
  )
}

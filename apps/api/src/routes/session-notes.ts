/**
 * Session Notes routes.
 * No prefix — routes follow the /sessions/:sessionId/notes pattern.
 *
 * Supports both text and voice annotations for gaming sessions.
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import { voiceNotesProcessor } from '../services/voice-notes-processor.js'

const SessionParamsSchema = z.object({
  sessionId: z.string().uuid(),
})

const SaveNoteBody = z.object({
  content: z.string().min(1).max(10000),
  noteType: z.enum(['text', 'voice']),
  audioUrl: z.string().url().optional(),
  audioDuration: z.number().int().min(1).optional(),
})

export async function sessionNotesRoutes(app: FastifyInstance): Promise<void> {
  // ─── POST /sessions/:sessionId/notes ──────────────────────────────────────
  app.post(
    '/sessions/:sessionId/notes',
    {
      schema: {
        tags: ['Session Notes'],
        summary: 'Add a text or voice note to a session',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['sessionId'],
          properties: { sessionId: { type: 'string', format: 'uuid' } },
        },
        body: {
          type: 'object',
          required: ['content', 'noteType'],
          properties: {
            content: { type: 'string', minLength: 1, maxLength: 10000 },
            noteType: { type: 'string', enum: ['text', 'voice'] },
            audioUrl: { type: 'string', format: 'uri' },
            audioDuration: { type: 'integer', minimum: 1 },
          },
        },
      },
      preValidation: [requireAuth],
    },
    async (request, reply) => {
      try {
        const { sessionId } = SessionParamsSchema.parse(request.params)
        const body = SaveNoteBody.parse(request.body)
        const userId = request.user!.id

        const note = await voiceNotesProcessor.saveNote(
          sessionId,
          userId,
          body.content,
          body.noteType,
          body.audioUrl,
          body.audioDuration,
        )

        // For voice notes, include the transcript analysis in the response
        const analysis =
          body.noteType === 'voice'
            ? voiceNotesProcessor.analyzeTranscript(body.content)
            : undefined

        return reply.code(201).send({
          success: true,
          data: analysis ? { ...note, analysis } : note,
        })
      } catch (err) {
        app.log.error({ err }, 'save note error')
        return reply.code(500).send({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to save note' },
        })
      }
    },
  )

  // ─── GET /sessions/:sessionId/notes ───────────────────────────────────────
  app.get(
    '/sessions/:sessionId/notes',
    {
      schema: {
        tags: ['Session Notes'],
        summary: 'Get all notes for a session',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['sessionId'],
          properties: { sessionId: { type: 'string', format: 'uuid' } },
        },
      },
      preValidation: [requireAuth],
    },
    async (request, reply) => {
      try {
        const { sessionId } = SessionParamsSchema.parse(request.params)
        const userId = request.user!.id

        const notes = await voiceNotesProcessor.getSessionNotes(sessionId, userId)
        return reply.send({ success: true, data: notes })
      } catch (err) {
        app.log.error({ err }, 'get notes error')
        return reply.code(500).send({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve notes' },
        })
      }
    },
  )
}

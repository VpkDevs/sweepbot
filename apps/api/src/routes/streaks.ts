/**
 * Streak routes.
 * Prefix: /streaks
 *
 * Daily activity tracking, leaderboard, and nightly maintenance.
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import { requireCronSecret } from '../middleware/cron-auth.js'
import { streakManager } from '../services/streak-manager.js'

const LeaderboardQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export async function streakRoutes(app: FastifyInstance): Promise<void> {
  // ─── GET /streaks ──────────────────────────────────────────────────────────
  app.get(
    '/',
    {
      schema: {
        tags: ['Streaks'],
        summary: 'Get current streak for the authenticated user',
        security: [{ bearerAuth: [] }],
      },
      preValidation: [requireAuth],
    },
    async (request, reply) => {
      try {
        const streak = await streakManager.getStreak(request.user!.id)

        if (!streak) {
          return reply.send({
            success: true,
            data: {
              currentStreak: 0,
              longestStreak: 0,
              lastActivityDate: null,
              freezeCredits: 0,
            },
          })
        }

        return reply.send({ success: true, data: streak })
      } catch (err) {
        app.log.error({ err }, 'get streak error')
        return reply.code(500).send({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve streak' },
        })
      }
    },
  )

  // ─── POST /streaks/activity ────────────────────────────────────────────────
  app.post(
    '/activity',
    {
      schema: {
        tags: ['Streaks'],
        summary: 'Record a daily activity (idempotent — safe to call multiple times per day)',
        security: [{ bearerAuth: [] }],
      },
      preValidation: [requireAuth],
    },
    async (request, reply) => {
      try {
        const result = await streakManager.recordActivity(request.user!.id)
        return reply.send({ success: true, data: result })
      } catch (err) {
        app.log.error({ err }, 'record activity error')
        return reply.code(500).send({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to record activity' },
        })
      }
    },
  )

  // ─── GET /streaks/leaderboard ──────────────────────────────────────────────
  app.get(
    '/leaderboard',
    {
      schema: {
        tags: ['Streaks'],
        summary: 'Get top-N users by current streak',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: { limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 } },
        },
      },
      preValidation: [requireAuth],
    },
    async (request, reply) => {
      try {
        const { limit } = LeaderboardQuerySchema.parse(request.query)
        const entries = await streakManager.getLeaderboard(limit)
        return reply.send({ success: true, data: entries })
      } catch (err) {
        app.log.error({ err }, 'leaderboard error')
        return reply.code(500).send({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve leaderboard' },
        })
      }
    },
  )

  // ─── POST /streaks/nightly-check ──────────────────────────────────────────
  // Internal endpoint — called by a nightly cron job.
  // Protected via shared secret to prevent arbitrary external triggering.
  app.post(
    '/nightly-check',
    {
      schema: {
        tags: ['Internal'],
        summary: 'Run nightly streak check — protect or reset streaks for inactive users',
      },
      preValidation: [requireCronSecret('nightly-check')],
    },
    async (_request, reply) => {
      try {
        await streakManager.processNightlyCheck()
        return reply.send({ success: true, data: { message: 'Nightly streak check complete' } })
      } catch (err) {
        app.log.error({ err }, 'nightly-check error')
        return reply.code(500).send({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Nightly check failed' },
        })
      }
    },
  )
}

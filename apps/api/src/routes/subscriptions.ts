/**
 * Subscription routes.
 * Prefix: /subscriptions
 *
 * Handles trial lifecycle: start, status, and batch expiry (for cron).
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import { trialManager } from '../services/trial-manager.js'

const StartTrialBody = z.object({
  displayName: z.string().max(100).optional(),
})

export async function subscriptionRoutes(app: FastifyInstance): Promise<void> {
  // ─── POST /subscriptions/start-trial ──────────────────────────────────────
  app.post(
    '/start-trial',
    {
      schema: {
        tags: ['Subscriptions'],
        summary: 'Start a 14-day Pro trial',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            displayName: { type: 'string', maxLength: 100 },
          },
        },
      },
      preValidation: [requireAuth],
    },
    async (request, reply) => {
      try {
        const body = StartTrialBody.parse(request.body)
        const user = request.user!

        const result = await trialManager.startTrial(user.id, user.email ?? '', body.displayName)

        return reply.code(201).send({
          success: true,
          data: {
            trialEndsAt: result.trialEndsAt,
            message: 'Your 14-day Pro trial has started. Enjoy full access!',
          },
        })
      } catch (err) {
        if (err instanceof Error && err.message === 'TRIAL_ALREADY_USED') {
          return reply.code(409).send({
            success: false,
            error: {
              code: 'TRIAL_ALREADY_USED',
              message: 'You have already used your free trial.',
            },
          })
        }
        app.log.error({ err }, 'start-trial error')
        return reply.code(500).send({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to start trial' },
        })
      }
    }
  )

  // ─── GET /subscriptions/trial-status ──────────────────────────────────────
  app.get(
    '/trial-status',
    {
      schema: {
        tags: ['Subscriptions'],
        summary: 'Get current trial status for the authenticated user',
        security: [{ bearerAuth: [] }],
      },
      preValidation: [requireAuth],
    },
    async (request, reply) => {
      try {
        const status = await trialManager.getTrialStatus(request.user!.id)

        if (!status) {
          return reply.code(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'No subscription found for this user' },
          })
        }

        return reply.send({ success: true, data: status })
      } catch (err) {
        app.log.error({ err }, 'trial-status error')
        return reply.code(500).send({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve trial status' },
        })
      }
    }
  )

  // ─── POST /subscriptions/expire-trials ────────────────────────────────────
  // Internal endpoint — called by a cron job, no auth required.
  app.post(
    '/expire-trials',
    {
      schema: {
        tags: ['Internal'],
        summary: 'Batch-expire all past-due trials (cron use only)',
      },
    },
    async (_request, reply) => {
      try {
        const count = await trialManager.expireTrials()
        return reply.send({
          success: true,
          data: { expired: count, message: `${count} trial(s) expired` },
        })
      } catch (err) {
        app.log.error({ err }, 'expire-trials error')
        return reply.code(500).send({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to expire trials' },
        })
      }
    }
  )
}

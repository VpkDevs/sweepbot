/**
 * payment-methods.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * REST routes for managing a user's saved Stripe payment methods.
 * Prefix: /payment-methods  (registered in routes/index.ts)
 *
 * All routes require authentication via the `requireAuth` pre-validation hook.
 *
 * Endpoints
 *   GET    /               — list all saved cards for the current user
 *   PUT    /:id/default    — set a payment method as the invoice default
 *   DELETE /:id            — remove a payment method from the Stripe vault
 *
 * Security notes
 *  • Ownership is verified server-side inside stripe.service.ts before any
 *    detach call — users cannot remove cards belonging to other customers.
 *  • Raw Stripe PaymentMethod objects are returned as-is so the client can
 *    render card brand, last4, and expiry without a separate Stripe SDK call.
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import { logger } from '../utils/logger.js'
import {
  listPaymentMethods,
  setDefaultPaymentMethod,
  removePaymentMethod,
  StripeServiceError,
} from '../services/stripe.service.js'

// ─── Shared param schema ──────────────────────────────────────────────────────

const paymentMethodParamSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^pm_[A-Za-z0-9]+$/, 'Invalid Stripe payment method ID format'),
})

// ─── Helper: map StripeServiceError → HTTP status ────────────────────────────

function stripeErrorStatus(code: StripeServiceError['code']): number {
  switch (code) {
    case 'CUSTOMER_NOT_FOUND':
    case 'PAYMENT_METHOD_NOT_FOUND':
    case 'SUBSCRIPTION_NOT_FOUND':
      return 404
    case 'OWNERSHIP_VIOLATION':
      return 403
    case 'RATE_LIMITED':
      return 429
    default:
      return 500
  }
}

// ─── Route registration ───────────────────────────────────────────────────────

/**
 * Register payment-method management routes on the provided Fastify instance.
 *
 * @param app - Fastify instance already scoped to the /payment-methods prefix
 */
export async function paymentMethodRoutes(app: FastifyInstance): Promise<void> {
  // Auth guard on every route in this plugin
  app.addHook('preValidation', requireAuth)

  // ── GET /payment-methods ──────────────────────────────────────────────────
  // Returns an array of Stripe PaymentMethod objects (type: 'card').
  // Returns [] if the user has no Stripe customer or no saved methods.
  app.get(
    '/',
    {
      schema: {
        tags: ['Billing'],
        summary: 'List saved payment methods (cards) for the current user',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  description: 'Stripe PaymentMethod object',
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = request.user!.id

      try {
        const methods = await listPaymentMethods(userId)
        return reply.send({ success: true, data: methods })
      } catch (err) {
        if (err instanceof StripeServiceError) {
          logger.warn({ err, userId }, 'listPaymentMethods failed')
          return reply
            .code(stripeErrorStatus(err.code) as unknown as 200)
            .send({ success: false, error: { code: err.code, message: err.message } })
        }
        throw err
      }
    },
  )

  // ── PUT /payment-methods/:id/default ──────────────────────────────────────
  // Set a specific payment method as the default for future invoices.
  app.put(
    '/:id/default',
    {
      schema: {
        tags: ['Billing'],
        summary: 'Set a payment method as the default for future invoices',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: { updated: { type: 'boolean' } },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = request.user!.id

      const parseResult = paymentMethodParamSchema.safeParse(request.params)
      if (!parseResult.success) {
        return reply.code(400 as unknown as 200).send({
          success: false,
          error: {
            code: 'INVALID_PAYMENT_METHOD_ID',
            message: parseResult.error.errors[0]?.message ?? 'Invalid payment method ID',
          },
        })
      }

      const { id: paymentMethodId } = parseResult.data

      try {
        await setDefaultPaymentMethod(userId, paymentMethodId)
        return reply.send({ success: true, data: { updated: true } })
      } catch (err) {
        if (err instanceof StripeServiceError) {
          logger.warn({ err, userId, paymentMethodId }, 'setDefaultPaymentMethod failed')
          return reply
            .code(stripeErrorStatus(err.code) as unknown as 200)
            .send({ success: false, error: { code: err.code, message: err.message } })
        }
        throw err
      }
    },
  )

  // ── DELETE /payment-methods/:id ───────────────────────────────────────────
  // Remove (detach) a payment method from the user's Stripe vault.
  // Includes server-side ownership verification before detaching.
  app.delete(
    '/:id',
    {
      schema: {
        tags: ['Billing'],
        summary: 'Remove a saved payment method from the Stripe vault',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: { removed: { type: 'boolean' } },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = request.user!.id

      const parseResult = paymentMethodParamSchema.safeParse(request.params)
      if (!parseResult.success) {
        return reply.code(400 as unknown as 200).send({
          success: false,
          error: {
            code: 'INVALID_PAYMENT_METHOD_ID',
            message: parseResult.error.errors[0]?.message ?? 'Invalid payment method ID',
          },
        })
      }

      const { id: paymentMethodId } = parseResult.data

      try {
        await removePaymentMethod(userId, paymentMethodId)
        return reply.send({ success: true, data: { removed: true } })
      } catch (err) {
        if (err instanceof StripeServiceError) {
          logger.warn({ err, userId, paymentMethodId }, 'removePaymentMethod failed')
          return reply
            .code(stripeErrorStatus(err.code) as unknown as 200)
            .send({ success: false, error: { code: err.code, message: err.message } })
        }
        throw err
      }
    },
  )

  // ── POST /payment-methods/preview-change ──────────────────────────────────
  // Preview the proration invoice for switching to a different plan price.
  // Returns the Stripe UpcomingInvoice object so the UI can display the
  // exact charge/credit before the user confirms a plan change.
  app.post(
    '/preview-change',
    {
      schema: {
        tags: ['Billing'],
        summary: 'Preview the proration that would result from a plan change',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['priceId'],
          properties: { priceId: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const userId = request.user!.id
      const { priceId } = z
        .object({ priceId: z.string().min(1).regex(/^price_[A-Za-z0-9]+$/, 'Invalid Stripe price ID') })
        .parse(request.body)

      const { previewSubscriptionChange } = await import('../services/stripe.service.js')

      try {
        const preview = await previewSubscriptionChange(userId, priceId)
        return reply.send({ success: true, data: preview })
      } catch (err) {
        if (err instanceof StripeServiceError) {
          return reply
            .code(stripeErrorStatus(err.code) as unknown as 200)
            .send({ success: false, error: { code: err.code, message: err.message } })
        }
        throw err
      }
    },
  )
}

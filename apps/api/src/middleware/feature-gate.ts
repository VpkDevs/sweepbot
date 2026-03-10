/**
 * Feature Gate middleware.
 * Guards routes by subscription tier, with transparent pass-through for active trial users.
 */

import type { FastifyRequest, FastifyReply } from 'fastify'
import { sql } from 'drizzle-orm'
import { query } from '../db/client.js'

/**
 * Returns a Fastify preValidation hook that allows access when the authenticated
 * user's tier matches one of the provided tiers, OR when the user has an active trial.
 *
 * Usage:
 *   app.get('/pro-feature', { preValidation: [requireAuth, requireTier('pro', 'enterprise')] }, handler)
 */
export function requireTier(
  ...tiers: string[]
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      return reply.code(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      })
    }

    // Fast path: tier in token already satisfies requirement
    if (tiers.includes(request.user.tier)) return

    // Slow path: check for an active trial in the subscriptions table
    // (the tier in the JWT may lag behind the subscription state)
    const { rows } = await query<{ status: string }>(sql`
      SELECT status
      FROM subscriptions
      WHERE user_id = ${request.user.id}
        AND status = 'trialing'
        AND trial_ends_at > NOW()
      LIMIT 1
    `)

    if (rows.length > 0) return

    return reply.code(403).send({
      success: false,
      error: {
        code: 'UPGRADE_REQUIRED',
        message: `This feature requires one of the following plans: ${tiers.join(', ')}`,
      },
    })
  }
}

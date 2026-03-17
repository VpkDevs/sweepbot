/**
 * Subscriptions API — SweepBot
 *
 * Internal/admin endpoints for subscription lifecycle management.
 *
 * Endpoints:
 *   POST /subscriptions/expire-trials  — [Admin] Bulk-expire overdue trials
 */

import type { FastifyPluginAsync } from 'fastify'
import { timingSafeEqual } from 'node:crypto'
import { query as dbQuery } from '../db/client.js'
import { sql } from 'drizzle-orm'
import { env } from '../utils/env.js'

// ============================================================================
// Helpers
// ============================================================================

/**
 * Constant-time comparison of two strings using Node's crypto.timingSafeEqual.
 * Prevents timing-based side-channel attacks on secret comparisons.
 */
function safeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a)
    const bufB = Buffer.from(b)
    // timingSafeEqual requires equal-length buffers; unequal lengths are always false
    if (bufA.length !== bufB.length) return false
    return timingSafeEqual(bufA, bufB)
  } catch {
    return false
  }
}

// ============================================================================
// Route Handler
// ============================================================================

export const subscriptionRoutes: FastifyPluginAsync = async (app) => {
  /**
   * POST /subscriptions/expire-trials
   *
   * Admin-only endpoint: marks all trial subscriptions whose trial_end is in
   * the past as 'expired'. Intended to be called by a cron job or internal
   * scheduler — NOT a public user-facing endpoint.
   *
   * Auth: x-admin-secret header must match env.ADMIN_SECRET (constant-time).
   */
  app.post('/expire-trials', async (request, reply) => {
    const adminSecret = request.headers['x-admin-secret']

    if (
      !env.ADMIN_SECRET ||
      typeof adminSecret !== 'string' ||
      !safeCompare(adminSecret, env.ADMIN_SECRET)
    ) {
      return reply.code(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid or missing admin secret' },
      })
    }

    const result = await dbQuery(sql`
      UPDATE subscriptions
      SET
        status     = 'expired',
        updated_at = NOW()
      WHERE
        status     = 'trialing'
        AND trial_end < NOW()
      RETURNING id
    `)

    const expiredCount = result.rows.length

    return reply.code(200).send({
      success: true,
      data: { expiredCount },
    })
  })
}

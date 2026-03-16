/**
 * Cron authentication middleware.
 * Protects internal cron endpoints with a shared secret.
 */

import type { FastifyRequest, FastifyReply } from 'fastify'
import { constantTimeCompare } from '@sweepbot/utils'
import { env } from '../utils/env.js'

/**
 * Returns a preValidation hook that guards an internal cron endpoint behind
 * a shared secret passed via either:
 *   - `x-cron-secret: <value>` header, or
 *   - `Authorization: Bearer <value>` header
 *
 * The configured secret is read from the `CRON_SECRET` environment variable.
 * If `CRON_SECRET` is not set the endpoint returns 500 (misconfigured).
 */
export function requireCronSecret(endpointName: string) {
  return async function cronAuthHook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const configuredSecret = env.CRON_SECRET

    if (!configuredSecret) {
      request.log.error(
        `${endpointName} attempted but no shared secret is configured (set CRON_SECRET)`,
      )
      return reply.code(500).send({
        success: false,
        error: { code: 'MISCONFIGURED', message: `${endpointName} is not configured` },
      })
    }

    const headerSecret = request.headers['x-cron-secret']
    const providedSecret =
      (Array.isArray(headerSecret) ? headerSecret[0] : headerSecret) ??
      request.headers.authorization?.replace(/^Bearer\s+/i, '')

    if (!providedSecret) {
      return reply.code(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Missing cron secret' },
      })
    }

    if (!constantTimeCompare(providedSecret, configuredSecret)) {
      return reply.code(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Invalid cron secret' },
      })
    }
  }
}

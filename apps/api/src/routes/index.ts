/**
 * Route registration index.
 * Registers all route modules under the /api/v1 prefix.
 */

import type { FastifyInstance } from 'fastify'
import { healthRoutes } from './health.js'
import { platformRoutes } from './platforms.js'
import { sessionRoutes } from './sessions.js'
import { analyticsRoutes } from './analytics.js'
import { userRoutes } from './user.js'
import { jackpotRoutes } from './jackpots.js'
import { redemptionRoutes } from './redemptions.js'
import { trustRoutes } from './trust.js'
import { webhookRoutes } from './webhooks.js'

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(healthRoutes)
  await app.register(platformRoutes, { prefix: '/platforms' })
  await app.register(sessionRoutes, { prefix: '/sessions' })
  await app.register(analyticsRoutes, { prefix: '/analytics' })
  await app.register(userRoutes, { prefix: '/user' })
  await app.register(jackpotRoutes, { prefix: '/jackpots' })
  await app.register(redemptionRoutes, { prefix: '/redemptions' })
  await app.register(trustRoutes, { prefix: '/trust-index' })
  await app.register(webhookRoutes, { prefix: '/webhooks' })
}

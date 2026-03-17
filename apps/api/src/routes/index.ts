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
import { flowRoutes } from './flows.js'
import { featuresRoutes } from './features.js'
import { notificationsRoutes } from './notifications.js'
import { achievementRoutes } from './achievements.js'
import { streaksRoutes } from './streaks.js'
import { sessionNotesRoutes } from './session-notes.js'
import { gameIntelligenceRoutes } from './intelligence.js'
import { paymentMethodRoutes } from './payment-methods.js'
import { taxRoutes } from './tax.js'
import { subscriptionRoutes } from './subscriptions.js'

/**
 * Registers all API route modules on the given Fastify instance so they become available under their configured prefixes.
 *
 * @param app - The Fastify instance to attach route modules to
 */
export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(healthRoutes)
  await app.register(platformRoutes, { prefix: '/platforms' })
  await app.register(sessionRoutes, { prefix: '/sessions' })
  await app.register(analyticsRoutes, { prefix: '/analytics' })
  await app.register(userRoutes, { prefix: '/user' })
  await app.register(jackpotRoutes, { prefix: '/jackpots' })
  await app.register(redemptionRoutes, { prefix: '/redemptions' })
  await app.register(trustRoutes, { prefix: '/trust-index' })
  await app.register(flowRoutes, { prefix: '/flows' })
  await app.register(featuresRoutes, { prefix: '/features' })
  await app.register(notificationsRoutes, { prefix: '/notifications' })
  await app.register(achievementRoutes, { prefix: '/achievements' })
  await app.register(streaksRoutes, { prefix: '/streaks' })
  await app.register(sessionNotesRoutes, { prefix: '/session-notes' })
  await app.register(webhookRoutes, { prefix: '/webhooks' })
  await app.register(gameIntelligenceRoutes, { prefix: '/intelligence' })
  await app.register(paymentMethodRoutes, { prefix: '/payment-methods' })
  await app.register(taxRoutes, { prefix: '/tax' })
  await app.register(subscriptionRoutes, { prefix: '/subscriptions' })
}

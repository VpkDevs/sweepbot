import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { query as dbQuery, unsafeQuery } from '../db/client.js'
import { requireAuth } from '../middleware/auth.js'
import { sql } from 'drizzle-orm'
import Stripe from 'stripe'
import { env } from '../utils/env.js'
import {
  createCheckoutSession,
  createPortalSession,
  changeSubscriptionPlan,
  cancelSubscription,
  reactivateSubscription,
  applyPromotionCode,
  StripeServiceError,
} from '../services/stripe.service.js'

const updateProfileValidationMessages: Record<string, string> = {
  avatarUrl: 'Invalid avatar URL',
}

const AddPlatformBody = z.object({
  platformId: z.string().uuid(),
  platformUsername: z.string().min(1).max(255),
  displayName: z.string().max(255).optional(),
  // Credentials are stored only client-side in the encrypted vault
  // We only receive the platform account ID for association
})

const UpdateSettingsBody = z.object({
  weeklyGoalAmount: z.number().min(0).optional(),
  timezone: z.string().optional(),
  currencyDisplay: z.enum(['sc', 'usd_equivalent']).optional(),
  dashboardLayout: z.enum(['compact', 'standard', 'expanded']).optional(),
  emailNotifications: z
    .object({
      weeklyDigest: z.boolean().optional(),
      jackpotAlerts: z.boolean().optional(),
      tosChanges: z.boolean().optional(),
      redemptionUpdates: z.boolean().optional(),
    })
    .optional(),
})

const UpdateProfileBody = z.object({
  displayName: z.string().min(1).max(100).optional(),
  avatarUrl: z.string().url().optional(),
  bio: z.string().max(500).optional(),
})

/**
 * Register authenticated user-related HTTP routes on the given Fastify instance.
 *
 * Registers endpoints for profile, settings, connected platforms, subscription/checkout,
 * billing portal, notification preferences, tax summary, self-exclusion, and account deletion,
 * and applies the `requireAuth` pre-validation hook so all routes require an authenticated user.
 *
 * @param app - The Fastify instance to attach the user routes to
 */
export async function userRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preValidation', requireAuth)

  // ─── GET /user/profile ────────────────────────────────────────────────────
  app.get(
    '/profile',
    {
      schema: {
        tags: ['User'],
        summary: 'Get the authenticated user profile and subscription info',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const userId = request.user!.id

      const result = await dbQuery(sql`
        SELECT
          pr.id,
          pr.email,
          pr.display_name,
          pr.avatar_url,
          pr.bio,
          pr.created_at,
          sub.tier,
          sub.status AS subscription_status,
          sub.current_period_end,
          sub.cancel_at_period_end,
          sub.stripe_customer_id IS NOT NULL AS has_payment_method,
          (
            SELECT COUNT(*) FROM user_platforms
            WHERE user_id = pr.id AND is_active = TRUE
          ) AS platform_count,
          (
            SELECT COUNT(*) FROM sessions
            WHERE user_id = pr.id
          ) AS total_sessions
        FROM profiles pr
        LEFT JOIN subscriptions sub ON sub.user_id = pr.id
          AND sub.status IN ('active', 'trialing', 'past_due')
        WHERE pr.id = ${userId}
      `)

      if (!result.rows.length) {
        return reply
          .code(404)
          .send({ error: 'NOT_FOUND', message: 'Profile not found', status: 404 })
      }

      return reply.send({ success: true, data: result.rows[0] })
    }
  )

  // ─── PATCH /user/profile ──────────────────────────────────────────────────
  app.patch(
    '/profile',
    {
      schema: {
        tags: ['User'],
        summary: 'Update user profile',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            displayName: { type: 'string' },
            avatarUrl: { type: 'string' },
            bio: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = request.user!.id
      let body: z.infer<typeof UpdateProfileBody>
      try {
        body = UpdateProfileBody.parse(request.body)
      } catch (error) {
        if (error instanceof z.ZodError) {
          const message =
            error.issues
              .map((issue) => updateProfileValidationMessages[issue.path.join('.')])
              .find(Boolean) ?? 'Invalid profile update payload'

          return reply.code(400).send({
            error: 'VALIDATION_ERROR',
            message,
            status: 400,
          })
        }

        throw error
      }

      const updates: string[] = ['updated_at = NOW()']
      const values: unknown[] = []
      let idx = 1

      if (body.displayName !== undefined) {
        updates.push(`display_name = $${idx++}`)
        values.push(body.displayName)
      }
      if (body.avatarUrl !== undefined) {
        updates.push(`avatar_url = $${idx++}`)
        values.push(body.avatarUrl)
      }
      if (body.bio !== undefined) {
        updates.push(`bio = $${idx++}`)
        values.push(body.bio)
      }

      values.push(userId)
      const result = await unsafeQuery(
        `UPDATE profiles SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      )

      return reply.send({ success: true, data: result.rows[0] ?? null })
    }
  )

  // ─── GET /user/settings ───────────────────────────────────────────────────
  app.get(
    '/settings',
    {
      schema: {
        tags: ['User'],
        summary: 'Get user settings and preferences',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const userId = request.user!.id

      const result = await dbQuery(sql`
        SELECT * FROM user_settings WHERE user_id = ${userId}
      `)

      // Return defaults if no settings row yet
      if (!result.rows.length) {
        return reply.send({
          success: true,
          data: {
            user_id: userId,
            weekly_goal_amount: null,
            timezone: 'America/New_York',
            currency_display: 'sc',
            dashboard_layout: 'standard',
            email_notifications: {
              weeklyDigest: true,
              jackpotAlerts: true,
              tosChanges: true,
              redemptionUpdates: true,
            },
          },
        })
      }

      return reply.send({ success: true, data: result.rows[0] ?? null })
    }
  )

  // ─── PUT /user/settings ───────────────────────────────────────────────────
  app.put(
    '/settings',
    {
      schema: {
        tags: ['User'],
        summary: 'Upsert user settings',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const userId = request.user!.id
      const body = UpdateSettingsBody.parse(request.body)

      await dbQuery(sql`
        INSERT INTO user_settings (user_id) VALUES (${userId})
        ON CONFLICT (user_id) DO NOTHING
      `)

      const updates: string[] = ['updated_at = NOW()']
      const values: unknown[] = []
      let idx = 1

      const fieldMap: Record<string, string> = {
        weeklyGoalAmount: 'weekly_goal_amount',
        timezone: 'timezone',
        currencyDisplay: 'currency_display',
        dashboardLayout: 'dashboard_layout',
      }

      for (const [key, col] of Object.entries(fieldMap)) {
        const val = (body as Record<string, unknown>)[key]
        if (val !== undefined) {
          updates.push(`${col} = $${idx++}`)
          values.push(val)
        }
      }

      if (body.emailNotifications !== undefined) {
        updates.push(`email_notifications = $${idx++}`)
        values.push(JSON.stringify(body.emailNotifications))
      }

      values.push(userId)
      const result = await unsafeQuery(
        `UPDATE user_settings SET ${updates.join(', ')} WHERE user_id = $${idx} RETURNING *`,
        values
      )

      return reply.send({ success: true, data: result.rows[0] ?? null })
    }
  )

  // ─── GET /user/platforms ──────────────────────────────────────────────────
  app.get(
    '/platforms',
    {
      schema: {
        tags: ['User'],
        summary: 'List platforms the user has connected',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const userId = request.user!.id

      const rows = await dbQuery(sql`
        SELECT
          up.id,
          up.platform_id,
          up.platform_username,
          up.display_name,
          up.is_active,
          up.sc_balance,
          up.gc_balance,
          up.last_synced_at,
          up.created_at,
          p.name AS platform_name,
          p.slug AS platform_slug,
          p.logo_url,
          p.url AS platform_url,
          p.affiliate_url,
          p.is_active AS platform_status,
          ti.overall_score AS trust_score,
          (
            SELECT COUNT(*) FROM sessions
            WHERE user_platform_id = up.id
          ) AS session_count,
          (
            SELECT MAX(started_at) FROM sessions
            WHERE user_platform_id = up.id
          ) AS last_played_at
        FROM user_platforms up
        INNER JOIN platforms p ON p.id = up.platform_id
        LEFT JOIN trust_index_scores ti ON ti.platform_id = p.id
          AND ti.calculated_at = (
            SELECT MAX(t2.calculated_at) FROM trust_index_scores t2
            WHERE t2.platform_id = p.id
          )
        WHERE up.user_id = ${userId}
        ORDER BY up.created_at ASC
      `)

      return reply.send({ success: true, data: rows.rows })
    }
  )

  // ─── POST /user/platforms ─────────────────────────────────────────────────
  app.post(
    '/platforms',
    {
      schema: {
        tags: ['User'],
        summary: 'Connect a new platform to the user account',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['platformId', 'platformUsername'],
          properties: {
            platformId: { type: 'string', format: 'uuid' },
            platformUsername: { type: 'string' },
            displayName: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = request.user!.id
      const body = AddPlatformBody.parse(request.body)
      const tier = request.user!.tier

      // Enforce platform limits by tier
      const tierLimits: Record<string, number> = {
        free: 2,
        starter: 8,
        pro: 999,
        analyst: 999,
        elite: 999,
      }
      const limit = tierLimits[tier] ?? 2

      const currentCount = await dbQuery(sql`
        SELECT COUNT(*) AS count FROM user_platforms
        WHERE user_id = ${userId} AND is_active = TRUE
      `)

      const count = Number((currentCount.rows[0] as { count: string } | undefined)?.count ?? '0')

      if (count >= limit) {
        return reply.code(403).send({
          error: 'FEATURE_GATED',
          message: `Your ${tier} plan supports up to ${limit} platforms. Upgrade to add more.`,
          status: 403,
        })
      }

      const result = await dbQuery(sql`
        INSERT INTO user_platforms
          (user_id, platform_id, platform_username, display_name)
        VALUES
          (${userId}, ${body.platformId}, ${body.platformUsername}, ${body.displayName ?? body.platformUsername})
        ON CONFLICT (user_id, platform_id) DO UPDATE
          SET is_active = TRUE, platform_username = EXCLUDED.platform_username, updated_at = NOW()
        RETURNING *
      `)

      return reply.code(201).send({ success: true, data: result.rows[0] ?? null })
    }
  )

  // ─── DELETE /user/platforms/:id ───────────────────────────────────────────
  app.delete(
    '/platforms/:id',
    {
      schema: {
        tags: ['User'],
        summary: 'Disconnect a platform (soft delete — preserves session history)',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: { id: { type: 'string', format: 'uuid' } },
          required: ['id'],
        },
      },
    },
    async (request, reply) => {
      const userId = request.user!.id
      const { id } = request.params as { id: string }

      await dbQuery(sql`
        UPDATE user_platforms
        SET is_active = FALSE, updated_at = NOW()
        WHERE id = ${id} AND user_id = ${userId}
      `)

      return reply.send({ success: true, data: { disconnected: true } })
    }
  )

  // ─── GET /user/subscription ───────────────────────────────────────────────
  // Full subscription record (tier, status, period dates, Stripe IDs)
  app.get('/subscription', async (request, reply) => {
    const userId = request.user!.id

    const result = await dbQuery(sql`
      SELECT
        s.tier,
        s.status,
        s.stripe_subscription_id,
        s.stripe_price_id,
        s.current_period_start,
        s.current_period_end,
        s.cancel_at_period_end,
        s.trial_end,
        p.stripe_customer_id
      FROM subscriptions s
      JOIN profiles p ON p.id = s.user_id
      WHERE s.user_id = ${userId}
      ORDER BY s.created_at DESC
      LIMIT 1
    `)

    if (!result.rows.length) {
      // Return default free-tier shape if no subscription row exists yet
      return reply.send({
        success: true,
        data: {
          tier: 'free',
          status: 'active',
          stripe_subscription_id: null,
          stripe_price_id: null,
          current_period_start: null,
          current_period_end: null,
          cancel_at_period_end: false,
          trial_end: null,
          stripe_customer_id: null,
        },
      })
    }

    return reply.send({ success: true, data: result.rows[0] ?? null })
  })

  // ─── POST /user/checkout ──────────────────────────────────────────────────
  // Create a Stripe Checkout session for a plan upgrade or lifetime purchase.
  // Returns { url } — the client should redirect to this URL.
  app.post('/checkout', async (request, reply) => {
    const userId = request.user!.id
    const { tier, cycle, promotionCode } = z
      .object({
        tier: z.enum(['starter', 'pro', 'analyst', 'elite', 'lifetime']),
        cycle: z.enum(['monthly', 'annual']).default('monthly'),
        /** Optional Stripe promotion code ID (promo_XXXX) to pre-apply */
        promotionCode: z.string().optional(),
      })
      .parse(request.body)

    // Map tier + cycle → price ID
    const priceMap: Record<string, string | undefined> = {
      'starter-monthly': env.STRIPE_PRICE_STARTER_MONTHLY,
      'starter-annual': env.STRIPE_PRICE_STARTER_ANNUAL,
      'pro-monthly': env.STRIPE_PRICE_PRO_MONTHLY,
      'pro-annual': env.STRIPE_PRICE_PRO_ANNUAL,
      'analyst-monthly': env.STRIPE_PRICE_ANALYST_MONTHLY,
      'analyst-annual': env.STRIPE_PRICE_ANALYST_ANNUAL,
      'elite-monthly': env.STRIPE_PRICE_ELITE_MONTHLY,
      'elite-annual': env.STRIPE_PRICE_ELITE_ANNUAL,
      'lifetime-monthly': env.STRIPE_PRICE_LIFETIME,
      'lifetime-annual': env.STRIPE_PRICE_LIFETIME,
    }

    const priceId = priceMap[`${tier}-${cycle}`]
    if (!priceId) {
      return reply.code(400).send({
        error: 'PRICE_NOT_CONFIGURED',
        message: `Price for ${tier}/${cycle} not configured.`,
        status: 400,
      })
    }

    // Resolve user email for customer creation
    const profileResult = await dbQuery(sql`
      SELECT email, display_name FROM profiles WHERE id = ${userId} LIMIT 1
    `)
    const profile = profileResult.rows[0] as Record<string, string | null> | undefined
    const email = profile?.['email'] as string | undefined
    if (!email) {
      return reply
        .code(400)
        .send({ error: 'PROFILE_NOT_FOUND', message: 'User profile email not found.', status: 400 })
    }

    const appUrl = (env.CORS_ORIGINS.split(',')[0] ?? 'https://sweepbot.app').trim()

    try {
      const displayName = profile?.['display_name'] as string | undefined
      const session = await createCheckoutSession({
        userId,
        email,
        ...(displayName != null ? { displayName } : {}),
        priceId,
        successUrl: `${appUrl}/settings#subscription?upgraded=1`,
        cancelUrl: `${appUrl}/pricing`,
        ...(promotionCode != null ? { promotionCode } : {}),
      })
      return reply.send({ success: true, data: { url: session.url } })
    } catch (err) {
      if (err instanceof StripeServiceError) {
        return reply.code(500).send({ error: err.code, message: err.message, status: 500 })
      }
      throw err
    }
  })

  // ─── GET /user/billing-portal ─────────────────────────────────────────────
  // Create a Stripe Billing Portal session and redirect the client to it.
  // Used as a direct anchor href — returns a redirect, not JSON.
  app.get('/billing-portal', async (request, reply) => {
    const userId = request.user!.id
    const appUrl = (env.CORS_ORIGINS.split(',')[0] ?? 'https://sweepbot.app').trim()

    try {
      const portalSession = await createPortalSession(userId, `${appUrl}/settings#subscription`)
      return reply.redirect(portalSession.url)
    } catch (err) {
      if (err instanceof StripeServiceError && err.code === 'CUSTOMER_NOT_FOUND') {
        // User hasn't checked out yet — send them to pricing
        return reply.redirect(`${appUrl}/pricing`)
      }
      throw err
    }
  })

  // ─── POST /user/subscription/change-plan ─────────────────────────────────
  // Immediately switch to a different Stripe price (tier or billing cycle).
  // Returns the updated Stripe Subscription object; proration is created by default.
  app.post('/subscription/change-plan', async (request, reply) => {
    const userId = request.user!.id
    const { priceId, prorationBehavior } = z
      .object({
        priceId: z
          .string()
          .min(1)
          .regex(/^price_[A-Za-z0-9]+$/, 'Invalid Stripe price ID'),
        prorationBehavior: z
          .enum(['create_prorations', 'none', 'always_invoice'])
          .default('create_prorations'),
      })
      .parse(request.body)

    try {
      const updated = await changeSubscriptionPlan(userId, priceId, prorationBehavior)
      return reply.send({ success: true, data: updated })
    } catch (err) {
      if (err instanceof StripeServiceError) {
        const status =
          err.code === 'SUBSCRIPTION_NOT_FOUND'
            ? 404
            : err.code === 'SUBSCRIPTION_NOT_ACTIVE'
              ? 409
              : 500
        return reply.code(status).send({ error: err.code, message: err.message, status })
      }
      throw err
    }
  })

  // ─── POST /user/subscription/cancel ──────────────────────────────────────
  // Cancel the user's active subscription.
  // Pass { immediately: true } to revoke access right away; default is
  // cancel_at_period_end so the user keeps access until the billing period closes.
  app.post('/subscription/cancel', async (request, reply) => {
    const userId = request.user!.id
    const { immediately } = z
      .object({ immediately: z.boolean().default(false) })
      .parse(request.body)

    try {
      const sub = await cancelSubscription(userId, immediately)
      return reply.send({
        success: true,
        data: {
          canceled: true,
          status: sub.status,
          cancel_at_period_end: sub.cancel_at_period_end,
        },
      })
    } catch (err) {
      if (err instanceof StripeServiceError) {
        const status = err.code === 'SUBSCRIPTION_NOT_FOUND' ? 404 : 500
        return reply.code(status).send({ error: err.code, message: err.message, status })
      }
      throw err
    }
  })

  // ─── POST /user/subscription/reactivate ──────────────────────────────────
  // Undo a scheduled cancellation (cancel_at_period_end → false).
  app.post('/subscription/reactivate', async (request, reply) => {
    const userId = request.user!.id

    try {
      const sub = await reactivateSubscription(userId)
      return reply.send({ success: true, data: { reactivated: true, status: sub.status } })
    } catch (err) {
      if (err instanceof StripeServiceError) {
        const status =
          err.code === 'SUBSCRIPTION_NOT_FOUND'
            ? 404
            : err.code === 'PLAN_ALREADY_ACTIVE'
              ? 409
              : 500
        return reply.code(status).send({ error: err.code, message: err.message, status })
      }
      throw err
    }
  })

  // ─── POST /user/subscription/apply-promo ─────────────────────────────────
  // Apply a Stripe promotion code to the user's current active subscription.
  app.post('/subscription/apply-promo', async (request, reply) => {
    const userId = request.user!.id
    const { promotionCodeId } = z
      .object({
        promotionCodeId: z
          .string()
          .min(1)
          .regex(/^promo_[A-Za-z0-9]+$/, 'Invalid Stripe promotion code ID (expected promo_XXXX)'),
      })
      .parse(request.body)

    try {
      const sub = await applyPromotionCode(userId, promotionCodeId)
      return reply.send({ success: true, data: { applied: true, discounts: sub.discounts } })
    } catch (err) {
      if (err instanceof StripeServiceError) {
        const status = err.code === 'SUBSCRIPTION_NOT_FOUND' ? 404 : 500
        return reply.code(status).send({ error: err.code, message: err.message, status })
      }
      throw err
    }
  })

  // ─── GET /user/notification-prefs ────────────────────────────────────────
  // Notification preferences — stored in user_settings.email_notifications JSONB
  app.get('/notification-prefs', async (request, reply) => {
    const userId = request.user!.id

    const result = await dbQuery(sql`
      SELECT
        COALESCE(
          (email_notifications->>'jackpot_surge')::boolean, true
        ) AS jackpot_surge,
        COALESCE(
          (email_notifications->>'jackpot_near_ceiling')::boolean, true
        ) AS jackpot_near_ceiling,
        COALESCE(
          (email_notifications->>'tos_change_major')::boolean, true
        ) AS tos_change_major,
        COALESCE(
          (email_notifications->>'tos_change_any')::boolean, false
        ) AS tos_change_any,
        COALESCE(
          (email_notifications->>'redemption_status')::boolean, true
        ) AS redemption_status,
        COALESCE(
          (email_notifications->>'weekly_digest')::boolean, true
        ) AS weekly_digest,
        COALESCE(
          (email_notifications->>'platform_trust_drop')::boolean, true
        ) AS platform_trust_drop,
        COALESCE(
          (email_notifications->>'bonus_calendar')::boolean, false
        ) AS bonus_calendar
      FROM user_settings
      WHERE user_id = ${userId}
    `)

    if (!result.rows.length) {
      // Return hardcoded defaults when no settings row exists
      return reply.send({
        success: true,
        data: {
          jackpot_surge: true,
          jackpot_near_ceiling: true,
          tos_change_major: true,
          tos_change_any: false,
          redemption_status: true,
          weekly_digest: true,
          platform_trust_drop: true,
          bonus_calendar: false,
        },
      })
    }

    return reply.send({ success: true, data: result.rows[0] ?? null })
  })

  // ─── PATCH /user/notification-prefs ──────────────────────────────────────
  // Update one or more notification preference flags
  app.patch('/notification-prefs', async (request, reply) => {
    const userId = request.user!.id
    const updates = z
      .object({
        jackpot_surge: z.boolean().optional(),
        jackpot_near_ceiling: z.boolean().optional(),
        tos_change_major: z.boolean().optional(),
        tos_change_any: z.boolean().optional(),
        redemption_status: z.boolean().optional(),
        weekly_digest: z.boolean().optional(),
        platform_trust_drop: z.boolean().optional(),
        bonus_calendar: z.boolean().optional(),
      })
      .strict()
      .parse(request.body)

    // Ensure settings row exists
    await dbQuery(sql`
      INSERT INTO user_settings (user_id) VALUES (${userId})
      ON CONFLICT (user_id) DO NOTHING
    `)

    // Merge updates into the JSONB column
    await dbQuery(sql`
      UPDATE user_settings
      SET
        email_notifications = COALESCE(email_notifications, '{}'::jsonb) || ${JSON.stringify(updates)}::jsonb,
        updated_at = NOW()
      WHERE user_id = ${userId}
    `)

    return reply.send({ success: true, data: { updated: true } })
  })

  // ─── GET /user/tax-summary ────────────────────────────────────────────────
  // Aggregate redemptions by calendar year and platform for tax reporting
  app.get('/tax-summary', async (request, reply) => {
    const userId = request.user!.id
    const { year } = z
      .object({ year: z.coerce.number().int().min(2020).max(2030).optional() })
      .parse(request.query)

    const targetYear = year ?? new Date().getFullYear()
    const startDate = `${targetYear}-01-01`
    const endDate = `${targetYear}-12-31`

    const byPlatform = await dbQuery(sql`
      SELECT
        r.platform_id,
        p.name AS platform_name,
        COUNT(*)::int AS redemption_count,
        COALESCE(SUM(r.amount_sc), 0)::numeric(12,4) AS total_sc,
        MAX(r.completed_at) AS latest_at
      FROM redemptions r
      LEFT JOIN platforms p ON p.id = r.platform_id
      WHERE r.user_id = ${userId}
        AND r.status = 'received'
        AND DATE(COALESCE(r.completed_at, r.created_at))
            BETWEEN ${startDate}::date AND ${endDate}::date
      GROUP BY r.platform_id, p.name
      ORDER BY total_sc DESC
    `)

    const totals = await dbQuery(sql`
      SELECT
        COUNT(*)::int AS redemption_count,
        COALESCE(SUM(r.amount_sc), 0)::numeric(12,4) AS total_redeemed_sc,
        COUNT(DISTINCT r.platform_id)::int AS platform_count
      FROM redemptions r
      WHERE r.user_id = ${userId}
        AND r.status = 'received'
        AND DATE(COALESCE(r.completed_at, r.created_at))
            BETWEEN ${startDate}::date AND ${endDate}::date
    `)

    return reply.send({
      success: true,
      data: {
        year: targetYear,
        ...((totals.rows[0] as Record<string, unknown>) ?? {}),
        by_platform: byPlatform.rows,
      },
    })
  })

  // ─── POST /user/self-exclude ──────────────────────────────────────────────
  // Activate self-exclusion (responsible play lock-out period)
  app.post('/self-exclude', async (request, reply) => {
    const userId = request.user!.id
    // days is always 30 — callers cannot shorten or extend the lockout window
    const EXCLUSION_DAYS = 30

    // Calculate new exclusion end time from now
    const now = new Date()
    const newExclusionUntil = new Date(now.getTime() + EXCLUSION_DAYS * 24 * 60 * 60 * 1000)

    // Ensure settings row exists
    await dbQuery(sql`
      INSERT INTO user_settings (user_id) VALUES (${userId})
      ON CONFLICT (user_id) DO NOTHING
    `)

    // Only set if the new end date is strictly later than any existing exclusion
    // This prevents overwrite-from-now semantics that would shorten a remaining lockout
    const existing = await dbQuery(sql`
      SELECT self_exclusion_until FROM user_settings WHERE user_id = ${userId}
    `)
    const existingUntil = (existing.rows[0] as Record<string, string | null> | undefined)?.[
      'self_exclusion_until'
    ]
    if (existingUntil && new Date(existingUntil) >= newExclusionUntil) {
      return reply.send({
        success: true,
        data: {
          self_exclusion_until: existingUntil,
          message: `Self-exclusion already active until ${new Date(existingUntil).toLocaleDateString()}`,
        },
      })
    }

    await dbQuery(sql`
      UPDATE user_settings
      SET
        self_exclusion_until = ${newExclusionUntil.toISOString()},
        updated_at = NOW()
      WHERE user_id = ${userId}
    `)

    return reply.send({
      success: true,
      data: {
        self_exclusion_until: newExclusionUntil.toISOString(),
        message: `Self-exclusion active until ${newExclusionUntil.toLocaleDateString()}`,
      },
    })
  })

  // ─── DELETE /user/account ─────────────────────────────────────────────────
  // Hard-deletes the auth user (cascades to profiles + all user data).
  // Also cancels active Stripe subscription if present.
  app.delete('/account', async (request, reply) => {
    const userId = request.user!.id

    // Cancel active Stripe subscription before deleting
    const subResult = await dbQuery(sql`
      SELECT stripe_subscription_id
      FROM subscriptions
      WHERE user_id = ${userId}
        AND stripe_subscription_id IS NOT NULL
        AND status IN ('active', 'trialing', 'past_due')
      LIMIT 1
    `)
    const sub = subResult.rows[0] as Record<string, string | null> | undefined

    if (sub?.['stripe_subscription_id']) {
      const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2025-02-24.acacia' })
      // Propagate Stripe errors — abort deletion if cancellation fails
      await stripe.subscriptions.cancel(sub['stripe_subscription_id'])
    }

    // Delete via Supabase admin (auth.users deletion cascades to profiles)
    const { createClient } = await import('@supabase/supabase-js')
    const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (error) {
      return reply.code(500).send({ error: 'DELETE_FAILED', message: error.message, status: 500 })
    }

    return reply.send({ success: true, data: { deleted: true } })
  })
}

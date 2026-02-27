import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { query as dbQuery, unsafeQuery } from '../db/client.js'
import { requireAuth } from '../middleware/auth.js'
import { sql } from 'drizzle-orm'

const AddPlatformBody = z.object({
  platformId: z.string().uuid(),
  platformUsername: z.string().min(1).max(255),
  displayName: z.string().max(255).optional(),
  // Credentials are stored only client-side in the encrypted vault
  // We only receive the platform account ID for association
})

const UpdateSettingsBody = z.object({
  sessionAlertEnabled: z.boolean().optional(),
  sessionAlertThresholdMinutes: z.number().int().min(1).max(1440).optional(),
  lossLimitEnabled: z.boolean().optional(),
  lossLimitAmount: z.number().min(0).optional(),
  lossLimitPeriod: z.enum(['session', 'daily', 'weekly', 'monthly']).optional(),
  weeklyGoalAmount: z.number().min(0).optional(),
  responsiblePlayEnabled: z.boolean().optional(),
  chaseDetectionEnabled: z.boolean().optional(),
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

export async function userRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preValidation', requireAuth)

  // ─── GET /user/profile ────────────────────────────────────────────────────
  app.get(
    '/user/profile',
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
        return reply.code(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Profile not found' },
        })
      }

      return reply.send({ success: true, data: result.rows[0] })
    }
  )

  // ─── PATCH /user/profile ──────────────────────────────────────────────────
  app.patch(
    '/user/profile',
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
      const body = UpdateProfileBody.parse(request.body)

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

      return reply.send({ success: true, data: result.rows[0] })
    }
  )

  // ─── GET /user/settings ───────────────────────────────────────────────────
  app.get(
    '/user/settings',
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
            session_alert_enabled: true,
            session_alert_threshold_minutes: 120,
            loss_limit_enabled: false,
            loss_limit_amount: null,
            loss_limit_period: 'daily',
            weekly_goal_amount: null,
            responsible_play_enabled: true,
            chase_detection_enabled: true,
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

      return reply.send({ success: true, data: result.rows[0] })
    }
  )

  // ─── PUT /user/settings ───────────────────────────────────────────────────
  app.put(
    '/user/settings',
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
        sessionAlertEnabled: 'session_alert_enabled',
        sessionAlertThresholdMinutes: 'session_alert_threshold_minutes',
        lossLimitEnabled: 'loss_limit_enabled',
        lossLimitAmount: 'loss_limit_amount',
        lossLimitPeriod: 'loss_limit_period',
        weeklyGoalAmount: 'weekly_goal_amount',
        responsiblePlayEnabled: 'responsible_play_enabled',
        chaseDetectionEnabled: 'chase_detection_enabled',
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

      return reply.send({ success: true, data: result.rows[0] })
    }
  )

  // ─── GET /user/platforms ──────────────────────────────────────────────────
  app.get(
    '/user/platforms',
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
          p.status AS platform_status,
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
    '/user/platforms',
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

      const count = Number((currentCount.rows[0] as { count: string }).count)

      if (count >= limit) {
        return reply.code(403).send({
          success: false,
          error: {
            code: 'FEATURE_GATED',
            message: `Your ${tier} plan supports up to ${limit} platforms. Upgrade to add more.`,
          },
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

      return reply.code(201).send({ success: true, data: result.rows[0] })
    }
  )

  // ─── DELETE /user/platforms/:id ───────────────────────────────────────────
  app.delete(
    '/user/platforms/:id',
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
}

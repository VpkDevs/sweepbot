/**
 * Notification routes.
 * Prefix: /notifications
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { sql } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth.js'
import { query } from '../db/client.js'

// ── Reusable Zod schemas (also drive inferred types below) ───────────────────
const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  unread_only: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
})

const notifParamsSchema = z.object({ id: z.string().uuid() })

/**
 * Register authenticated notification routes on the provided Fastify instance.
 *
 * Adds endpoints under /notifications to list a user's notifications (with optional unread filter and limit),
 * return the unread count, mark a specific notification as read, mark all notifications as read, and delete a notification.
 *
 * @param app - The Fastify instance to register the routes on
 */
export async function notificationsRoutes(app: FastifyInstance): Promise<void> {
  // ── Auth guard on all routes ─────────────────────────────────────────────────
  app.addHook('preValidation', requireAuth)

  // ── GET /notifications ───────────────────────────────────────────────────────
  // Return user's notifications, newest first.
  app.get(
    '/',
    {
      schema: {
        querystring: listQuerySchema,
      },
    },
    async (request, reply) => {
      const { limit, unread_only } = request.query as z.infer<typeof listQuerySchema>
      const userId = request.user!.id

      const rows = await query<{
        id: string
        type: string
        title: string
        body: string
        icon: string | null
        href: string | null
        is_read: boolean
        read_at: string | null
        data: unknown
        created_at: string
      }>(sql`
        SELECT
          id,
          type,
          title,
          body,
          icon,
          href,
          is_read,
          read_at,
          data,
          created_at
        FROM notifications
        WHERE user_id = ${userId}
          ${unread_only ? sql`AND is_read = false` : sql``}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `)

      return reply.send({ success: true, data: rows })
    },
  )

  // ── GET /notifications/count ─────────────────────────────────────────────────
  // Returns unread count for the bell badge.
  app.get('/count', async (request, reply) => {
    const userId = request.user!.id
    const { rows } = await query<{ unread: number }>(sql`
      SELECT COUNT(*)::int AS unread
      FROM notifications
      WHERE user_id = ${userId} AND is_read = false
    `)
    return reply.send({ success: true, data: { unread: rows[0]?.unread ?? 0 } })
  })

  // ── PATCH /notifications/:id/read ────────────────────────────────────────────
  app.patch(
    '/:id/read',
    {
      schema: {
        params: notifParamsSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params as z.infer<typeof notifParamsSchema>
      const userId = request.user!.id

      await query(sql`
        UPDATE notifications
        SET is_read = true, read_at = NOW()
        WHERE id = ${id} AND user_id = ${userId}
      `)

      return reply.send({ success: true, data: { id } })
    },
  )

  // ── POST /notifications/read-all ─────────────────────────────────────────────
  app.post('/read-all', async (request, reply) => {
    const userId = request.user!.id

    await query(sql`
      UPDATE notifications
      SET is_read = true, read_at = NOW()
      WHERE user_id = ${userId} AND is_read = false
    `)

    return reply.send({ success: true, data: { marked: true } })
  })

  // ── DELETE /notifications/:id ────────────────────────────────────────────────
  app.delete(
    '/:id',
    {
      schema: {
        params: notifParamsSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params as z.infer<typeof notifParamsSchema>
      const userId = request.user!.id

      await query(sql`
        DELETE FROM notifications
        WHERE id = ${id} AND user_id = ${userId}
      `)

      return reply.send({ success: true, data: { deleted: true } })
    },
  )

  // ── POST /notifications/subscribe ────────────────────────────────────────────
  // Save a Web Push subscription endpoint for the current user.
  app.post(
    '/subscribe',
    {
      schema: {
        body: {
          type: 'object',
          required: ['endpoint', 'keys'],
          properties: {
            endpoint: { type: 'string' },
            keys: {
              type: 'object',
              required: ['p256dh', 'auth'],
              properties: {
                p256dh: { type: 'string' },
                auth: { type: 'string' },
              },
            },
            userAgent: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const body = z
        .object({
          endpoint: z.string().url(),
          keys: z.object({ p256dh: z.string(), auth: z.string() }),
          userAgent: z.string().max(500).optional(),
        })
        .parse(request.body)

      const userId = request.user!.id

      await query(sql`
        INSERT INTO push_subscriptions (user_id, endpoint, keys, user_agent)
        VALUES (
          ${userId},
          ${body.endpoint},
          ${JSON.stringify(body.keys)},
          ${body.userAgent ?? null}
        )
        ON CONFLICT (endpoint) DO UPDATE
          SET user_id = EXCLUDED.user_id,
              keys = EXCLUDED.keys,
              user_agent = EXCLUDED.user_agent,
              is_active = true,
              last_used_at = NOW()
      `)

      return reply.code(201).send({ success: true, data: { subscribed: true } })
    },
  )

  // ── DELETE /notifications/subscribe ──────────────────────────────────────────
  // Remove a Web Push subscription by endpoint.
  app.delete(
    '/subscribe',
    {
      schema: {
        body: {
          type: 'object',
          required: ['endpoint'],
          properties: { endpoint: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const { endpoint } = z
        .object({ endpoint: z.string() })
        .parse(request.body)

      const userId = request.user!.id

      await query(sql`
        DELETE FROM push_subscriptions
        WHERE endpoint = ${endpoint} AND user_id = ${userId}
      `)

      return reply.send({ success: true, data: { unsubscribed: true } })
    },
  )

  // ── GET /notifications/preferences ───────────────────────────────────────────
  // Returns the user's notification preference settings, creating defaults if absent.
  app.get('/preferences', async (request, reply) => {
    const userId = request.user!.id

    // Upsert defaults so the row always exists after first fetch
    await query(sql`
      INSERT INTO notification_preferences (user_id)
      VALUES (${userId})
      ON CONFLICT (user_id) DO NOTHING
    `)

    const { rows } = await query<{
      user_id: string
      jackpot_alerts: boolean
      tos_changes: boolean
      platform_outages: boolean
      flow_errors: boolean
      trial_reminders: boolean
      daily_summary: boolean
      weekly_report: boolean
      updated_at: string
    }>(sql`
      SELECT
        user_id,
        jackpot_alerts,
        tos_changes,
        platform_outages,
        flow_errors,
        trial_reminders,
        daily_summary,
        weekly_report,
        updated_at
      FROM notification_preferences
      WHERE user_id = ${userId}
    `)

    return reply.send({ success: true, data: rows[0] ?? null })
  })

  // ── PUT /notifications/preferences ───────────────────────────────────────────
  // Update the user's notification preference settings (partial update supported).
  app.put(
    '/preferences',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            jackpotAlerts: { type: 'boolean' },
            tosChanges: { type: 'boolean' },
            platformOutages: { type: 'boolean' },
            flowErrors: { type: 'boolean' },
            trialReminders: { type: 'boolean' },
            dailySummary: { type: 'boolean' },
            weeklyReport: { type: 'boolean' },
          },
        },
      },
    },
    async (request, reply) => {
      const body = z
        .object({
          jackpotAlerts: z.boolean().optional(),
          tosChanges: z.boolean().optional(),
          platformOutages: z.boolean().optional(),
          flowErrors: z.boolean().optional(),
          trialReminders: z.boolean().optional(),
          dailySummary: z.boolean().optional(),
          weeklyReport: z.boolean().optional(),
        })
        .parse(request.body)

      const userId = request.user!.id

      // Ensure the row exists before updating
      await query(sql`
        INSERT INTO notification_preferences (user_id)
        VALUES (${userId})
        ON CONFLICT (user_id) DO NOTHING
      `)

      await query(sql`
        UPDATE notification_preferences
        SET
          jackpot_alerts    = COALESCE(${body.jackpotAlerts ?? null}, jackpot_alerts),
          tos_changes       = COALESCE(${body.tosChanges ?? null}, tos_changes),
          platform_outages  = COALESCE(${body.platformOutages ?? null}, platform_outages),
          flow_errors       = COALESCE(${body.flowErrors ?? null}, flow_errors),
          trial_reminders   = COALESCE(${body.trialReminders ?? null}, trial_reminders),
          daily_summary     = COALESCE(${body.dailySummary ?? null}, daily_summary),
          weekly_report     = COALESCE(${body.weeklyReport ?? null}, weekly_report),
          updated_at        = NOW()
        WHERE user_id = ${userId}
      `)

      return reply.send({ success: true, data: { updated: true } })
    },
  )
}

// ── Helper: create a notification ─────────────────────────────────────────────
/**
 * Create a notification record for a user.
 *
 * Inserts a notification with the provided attributes; when `data` is supplied it will be stored as JSON.
 *
 * @param opts - Notification creation options
 * @param opts.userId - ID of the user who will receive the notification
 * @param opts.type - Notification category: `achievement`, `streak`, `milestone`, `big_win`, or `system`
 * @param opts.title - Short title for the notification
 * @param opts.body - Detailed message body for the notification
 * @param opts.icon - Optional URL or identifier for an icon associated with the notification
 * @param opts.href - Optional target URL for the notification action
 * @param opts.data - Optional arbitrary payload; stored as JSON when present
 */
export async function createNotification(opts: {
  userId: string
  type: 'achievement' | 'streak' | 'milestone' | 'big_win' | 'system'
  title: string
  body: string
  icon?: string
  href?: string
  data?: Record<string, unknown>
}): Promise<void> {
  await query(sql`
    INSERT INTO notifications (user_id, type, title, body, icon, href, data)
    VALUES (
      ${opts.userId},
      ${opts.type},
      ${opts.title},
      ${opts.body},
      ${opts.icon ?? null},
      ${opts.href ?? null},
      ${opts.data ? sql.raw(`'${JSON.stringify(opts.data)}'::jsonb`) : null}
    )
  `)
}

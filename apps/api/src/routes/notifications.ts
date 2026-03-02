/**
 * Notification routes.
 * Prefix: /notifications
 */

import type { FastifyInstance } from 'fastify'
import { sql } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth.js'
import { query } from '../db/client.js'

export async function notificationsRoutes(app: FastifyInstance): Promise<void> {
  // ── Auth guard on all routes ─────────────────────────────────────────────────
  app.addHook('preValidation', requireAuth)

  // ── GET /notifications ───────────────────────────────────────────────────────
  // Return user's notifications, newest first.
  app.get('/', async (request, reply) => {
    const query_params = request.query as { limit?: string; unread_only?: string }
    const limit = Math.min(Math.max(parseInt(query_params.limit ?? '30', 10) || 30, 1), 100)
    const unread_only = query_params.unread_only === 'true'
    const userId = request.user!.id

    const { rows } = await query<{
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
  app.patch('/:id/read', async (request, reply) => {
      const { id } = request.params as { id: string }
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
  app.delete('/:id', async (request, reply) => {
      const { id } = request.params as { id: string }
      const userId = request.user!.id

      await query(sql`
        DELETE FROM notifications
        WHERE id = ${id} AND user_id = ${userId}
      `)

      return reply.send({ success: true, data: { deleted: true } })
    },
  )
}

// ── Helper: create a notification ─────────────────────────────────────────────
// Call this from other routes (features.ts, etc.) when events occur.
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
      ${opts.data ? JSON.stringify(opts.data) : null}
    )
  `)
}

/**
 * Streaks API Routes
 * User activity streak tracking (daily login/session streaks)
 * Prefix: /streaks
 */

import { timingSafeEqual } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { sql } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth.js'
import { query } from '../db/client.js'
import { env } from '../utils/env.js'

// ─── Shared row type ─────────────────────────────────────────────────────────

interface StreakRow {
  current_streak: number
  longest_streak: number
  last_activity_date: string | null
  freeze_credits: number
}

function mapStreakRow(row: StreakRow) {
  return {
    currentStreak: row.current_streak,
    longestStreak: row.longest_streak,
    lastActivityDate: row.last_activity_date,
    freezeCredits: row.freeze_credits,
  }
}

const EMPTY_STREAK = {
  currentStreak: 0,
  longestStreak: 0,
  lastActivityDate: null,
  freezeCredits: 0,
}

// ─── Route registration ───────────────────────────────────────────────────────

export async function streaksRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /streaks ────────────────────────────────────────────────────────────
  // Returns the current user's streak — consistent camelCase shape in both branches.
  app.get(
    '/',
    { preValidation: [requireAuth] },
    async (request, reply) => {
      try {
        const userId = request.user!.id

        const { rows } = await query<StreakRow>(sql`
          SELECT current_streak, longest_streak, last_activity_date, freeze_credits
          FROM user_streaks
          WHERE user_id = ${userId}
        `)

        if (rows.length === 0) {
          return reply.send({ success: true, data: EMPTY_STREAK })
        }

        return reply.send({ success: true, data: mapStreakRow(rows[0]!) })
      } catch (error) {
        app.log.error({ error }, 'GET /streaks error')
        return reply.code(500).send({
          error: 'INTERNAL_ERROR',
          message: 'Failed to fetch streak',
          status: 500,
        })
      }
    },
  )

  // ── POST /streaks/nightly-check ─────────────────────────────────────────────
  // Bulk-resets streaks for users who missed yesterday.
  // Protected by x-admin-secret header — NOT exposed to end users.
  app.post('/nightly-check', async (request, reply) => {
    // Admin secret check — constant-time comparison to prevent timing attacks.
    const adminSecret = env.ADMIN_SECRET
    if (!adminSecret) {
      return reply.code(503).send({
        error: 'NOT_CONFIGURED',
        message: 'Admin secret not configured',
        status: 503,
      })
    }

    const provided = String(request.headers['x-admin-secret'] ?? '')

    let authorized = false
    try {
      const a = Buffer.from(provided.padEnd(adminSecret.length))
      const b = Buffer.from(adminSecret)
      authorized = a.length === b.length && timingSafeEqual(a, b)
    } catch {
      authorized = false
    }

    if (!authorized) {
      return reply.code(401).send({
        error: 'UNAUTHORIZED',
        message: 'Invalid or missing admin secret',
        status: 401,
      })
    }

    try {
      // Reset current_streak to 0 for any user whose last_activity_date is
      // strictly before yesterday (i.e. they missed at least one day).
      const { rows } = await query<{ affected: number }>(sql`
        UPDATE user_streaks
        SET current_streak = 0, updated_at = NOW()
        WHERE last_activity_date < CURRENT_DATE - INTERVAL '1 day'
          AND current_streak > 0
        RETURNING user_id
      `)

      return reply.send({
        success: true,
        data: { usersReset: rows.length },
      })
    } catch (error) {
      app.log.error({ error }, 'POST /streaks/nightly-check error')
      return reply.code(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Nightly streak check failed',
        status: 500,
      })
    }
  })
}

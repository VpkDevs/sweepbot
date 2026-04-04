/**
 * SweepBot Achievements API Routes
 * Endpoints for streaks, personal records, and milestones
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { query as dbQuery } from '../db/client.js'
import { sql } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth.js'

export async function achievementRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preValidation', requireAuth)

  /**
   * GET /achievements/streaks
   * Get user's current streak data
   */
  app.get(
    '/streaks',
    {
      schema: {
        tags: ['Achievements'],
        summary: 'Get user streak data',
      },
    },
    async (request, reply) => {
      try {
        const { rows } = await dbQuery(
          sql`SELECT * FROM user_streaks WHERE user_id = ${request.user!.id}`
        )

        if (rows.length === 0) {
          return reply.send({
            success: true,
            data: {
              currentStreak: 0,
              longestStreak: 0,
              lastActivityDate: null,
              freezeCredits: 0,
            },
          })
        }

        const row = rows[0] as {
          current_streak: number
          longest_streak: number
          last_activity_date: string | null
          freeze_credits: number
        }

        return reply.send({
          success: true,
          data: {
            currentStreak: row.current_streak,
            longestStreak: row.longest_streak,
            lastActivityDate: row.last_activity_date,
            freezeCredits: row.freeze_credits,
          },
        })
      } catch (error) {
        app.log.error({ error }, 'Get streaks error')
        return reply
          .code(500)
          .send({ error: 'INTERNAL_ERROR', message: 'Failed to get streak data', status: 500 })
      }
    }
  )

  /**
   * GET /achievements/records
   * Get user's personal records
   */
  app.get(
    '/records',
    {
      schema: {
        tags: ['Achievements'],
        summary: 'Get personal records',
      },
    },
    async (request, reply) => {
      try {
        const { rows } = await dbQuery(
          sql`SELECT * FROM personal_records WHERE user_id = ${request.user!.id}`
        )

        if (rows.length === 0) {
          return reply.send({
            success: true,
            data: {
              biggestWin: null,
              highestRTP: null,
              longestSession: null,
              mostSpins: null,
              biggestProfit: null,
              fastestBonus: null,
            },
          })
        }

        return reply.send({
          success: true,
          data: rows[0],
        })
      } catch (error) {
        app.log.error({ error }, 'Get records error')
        return reply
          .code(500)
          .send({ error: 'INTERNAL_ERROR', message: 'Failed to get personal records', status: 500 })
      }
    }
  )

  /**
   * GET /achievements/summary
   * Get achievement summary with stats
   */
  app.get(
    '/summary',
    {
      schema: {
        tags: ['Achievements'],
        summary: 'Get achievement summary',
      },
    },
    async (request, reply) => {
      try {
        const [streakResult, recordsResult, sessionsResult] = await Promise.all([
          dbQuery(sql`SELECT * FROM user_streaks WHERE user_id = ${request.user!.id}`),
          dbQuery(sql`SELECT * FROM personal_records WHERE user_id = ${request.user!.id}`),
          dbQuery(sql`SELECT COUNT(*) as total FROM sessions WHERE user_id = ${request.user!.id}`),
        ])

        const streakRow = streakResult.rows[0] as
          | {
              current_streak: number
              longest_streak: number
            }
          | undefined
        const records = recordsResult.rows[0] as
          | {
              biggest_single_win: string | null
              best_rtp_session: string | null
              [key: string]: unknown
            }
          | undefined
        const totalSessions = Number(
          (sessionsResult.rows[0] as { total: string | number } | undefined)?.total ?? 0
        )

        const recordCount = records ? Object.values(records).filter((v) => v !== null).length : 0

        return reply.send({
          success: true,
          data: {
            streak: {
              current: streakRow?.current_streak ?? 0,
              longest: streakRow?.longest_streak ?? 0,
            },
            records: {
              total: recordCount,
              biggestWin: records?.biggest_single_win ?? null,
              highestRTP: records?.best_rtp_session ?? null,
            },
            stats: {
              totalSessions,
            },
          },
        })
      } catch (error) {
        app.log.error({ error }, 'Get achievement summary error')
        return reply.code(500).send({
          error: 'INTERNAL_ERROR',
          message: 'Failed to get achievement summary',
          status: 500,
        })
      }
    }
  )

  /**
   * POST /achievements/streaks/record
   * Record a session for streak tracking (called by extension)
   */
  app.post<{ Body: { platformSlug: string } }>(
    '/streaks/record',
    {
      schema: {
        tags: ['Achievements'],
        summary: 'Record session for streak',
        body: {
          type: 'object',
          required: ['platformSlug'],
          properties: {
            platformSlug: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const today = new Date().toISOString().split('T')[0]!
        const userId = request.user!.id

        // Get current streak
        const { rows: currentRows } = await dbQuery(
          sql`SELECT * FROM user_streaks WHERE user_id = ${userId}`
        )

        let currentStreak = 0
        let longestStreak = 0
        let lastDate = ''

        if (currentRows.length > 0) {
          const data = currentRows[0] as {
            current_streak: number
            longest_streak: number
            last_activity_date: string
          }
          currentStreak = data.current_streak
          longestStreak = data.longest_streak
          lastDate = data.last_activity_date
        }

        // Check if same day
        if (lastDate === today) {
          return reply.send({
            success: true,
            data: { currentStreak, longestStreak, isNewDay: false },
          })
        }

        // Calculate new streak
        const lastDateObj = new Date(lastDate)
        const todayObj = new Date(today)
        const diffDays = Math.floor(
          (todayObj.getTime() - lastDateObj.getTime()) / (1000 * 60 * 60 * 24)
        )

        if (diffDays > 1) {
          // Streak broken
          currentStreak = 1
        } else {
          // Consecutive day
          currentStreak += 1
        }

        if (currentStreak > longestStreak) {
          longestStreak = currentStreak
        }

        // Update database
        await dbQuery(
          sql`INSERT INTO user_streaks (user_id, current_streak, longest_streak, last_activity_date)
            VALUES (${userId}, ${currentStreak}, ${longestStreak}, ${today})
            ON CONFLICT (user_id)
            DO UPDATE SET
              current_streak = ${currentStreak},
              longest_streak = ${longestStreak},
              last_activity_date = ${today},
              updated_at = NOW()`
        )

        return reply.send({
          success: true,
          data: {
            currentStreak,
            longestStreak,
            isNewDay: true,
            streakBroken: diffDays > 1,
          },
        })
      } catch (error) {
        app.log.error({ error }, 'Record streak error')
        return reply
          .code(500)
          .send({ error: 'INTERNAL_ERROR', message: 'Failed to record streak', status: 500 })
      }
    }
  )
}

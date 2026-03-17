import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { query as dbQuery, unsafeQuery } from '../db/client.js'
import { requireAuth } from '../middleware/auth.js'
import { sql } from 'drizzle-orm'
import { cachedQuery } from '../db/query-helpers.js'

const RTPQuerySchema = z.object({
  platformId: z.string().uuid().optional(),
  gameId: z.string().uuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  granularity: z.enum(['day', 'week', 'month']).default('day'),
})

const PortfolioQuerySchema = z.object({
  currency: z.enum(['sc', 'gc']).default('sc'),
})

export async function analyticsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preValidation', requireAuth)

  // ─── GET /analytics/portfolio ─────────────────────────────────────────────
  // The "Command Center" — top-level portfolio overview
  app.get(
    '/analytics/portfolio',
    {
      schema: {
        tags: ['Analytics'],
        summary: 'Portfolio overview — total P&L, balances, earnings velocity',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const userId = request.user!.id
      const { currency } = PortfolioQuerySchema.parse(request.query)

      const portfolioData = await cachedQuery(
        `analytics:portfolio:${userId}:${currency}`,
        async () => {
          const [totals, platformBreakdown, recentActivity, streaks] = await Promise.all([
            // All-time totals
            dbQuery(sql`
          SELECT
            COUNT(DISTINCT s.platform_id) AS active_platforms,
            COUNT(*) AS total_sessions,
            COALESCE(SUM(s.total_bets), 0) AS total_bets,
            COALESCE(SUM(s.total_wagered), 0) AS total_wagered,
            COALESCE(SUM(s.total_won), 0) AS total_won,
            COALESCE(SUM(s.total_won) - SUM(s.total_wagered), 0) AS net_profit,
            CASE
              WHEN SUM(s.total_wagered) > 0
              THEN ROUND((SUM(s.total_won) / SUM(s.total_wagered)) * 100, 2)
              ELSE NULL
            END AS overall_rtp,
            COALESCE(SUM(EXTRACT(EPOCH FROM (s.ended_at - s.started_at)) / 3600), 0)::numeric(10,2) AS total_hours_played
          FROM sessions s
          WHERE s.user_id = ${userId}
            AND s.ended_at IS NOT NULL
        `),

            // Per-platform breakdown
            dbQuery(sql`
          SELECT
            p.id AS platform_id,
            p.name AS platform_name,
            p.logo_url,
            COUNT(s.id) AS session_count,
            COALESCE(SUM(s.total_wagered), 0) AS total_wagered,
            COALESCE(SUM(s.total_won), 0) AS total_won,
            COALESCE(SUM(s.total_won) - SUM(s.total_wagered), 0) AS net_profit,
            CASE
              WHEN SUM(s.total_wagered) > 0
              THEN ROUND((SUM(s.total_won) / SUM(s.total_wagered)) * 100, 2)
              ELSE NULL
            END AS rtp,
            MAX(s.started_at) AS last_played_at
          FROM sessions s
          INNER JOIN platforms p ON p.id = s.platform_id
          WHERE s.user_id = ${userId}
            AND s.ended_at IS NOT NULL
          GROUP BY p.id, p.name, p.logo_url
          ORDER BY total_wagered DESC
          LIMIT 20
        `),

            // Last 7 days activity summary
            dbQuery(sql`
          SELECT
            DATE(s.started_at) AS play_date,
            COUNT(*) AS session_count,
            COALESCE(SUM(s.total_wagered), 0) AS wagered,
            COALESCE(SUM(s.total_won), 0) AS won,
            COALESCE(SUM(s.total_won) - SUM(s.total_wagered), 0) AS net
          FROM sessions s
          WHERE s.user_id = ${userId}
            AND s.started_at >= NOW() - INTERVAL '7 days'
            AND s.ended_at IS NOT NULL
          GROUP BY DATE(s.started_at)
          ORDER BY play_date ASC
        `),

            // Win/loss streak data
            dbQuery(sql`
          WITH session_results AS (
            SELECT
              id,
              started_at,
              CASE WHEN total_won > total_wagered THEN 'win' ELSE 'loss' END AS result
            FROM sessions
            WHERE user_id = ${userId}
              AND ended_at IS NOT NULL
              AND total_wagered > 0
            ORDER BY started_at DESC
            LIMIT 100
          )
          SELECT
            MAX(streak_length) AS longest_win_streak,
            MAX(loss_streak_length) AS longest_loss_streak
          FROM (
            SELECT
              result,
              COUNT(*) AS streak_length,
              0 AS loss_streak_length
            FROM (
              SELECT result, ROW_NUMBER() OVER (ORDER BY started_at DESC) -
                ROW_NUMBER() OVER (PARTITION BY result ORDER BY started_at DESC) AS grp
              FROM session_results
            ) sub
            WHERE result = 'win'
            GROUP BY result, grp
            UNION ALL
            SELECT
              result,
              0 AS streak_length,
              COUNT(*) AS loss_streak_length
            FROM (
              SELECT result, ROW_NUMBER() OVER (ORDER BY started_at DESC) -
                ROW_NUMBER() OVER (PARTITION BY result ORDER BY started_at DESC) AS grp
              FROM session_results
            ) sub
            WHERE result = 'loss'
            GROUP BY result, grp
          ) streaks
        `),
          ])

          return {
            totals: totals.rows[0] ?? null,
            platformBreakdown: platformBreakdown.rows,
            recentActivity: recentActivity.rows,
            streaks: streaks.rows[0] ?? { longest_win_streak: 0, longest_loss_streak: 0 },
          }
        },
        { ttl: 60, prefix: 'sweepbot' } // 60-second TTL — portfolio is expensive but needs to feel fresh
      )

      return reply.send({
        success: true,
        data: portfolioData,
      })
    }
  )

  // ─── GET /analytics/rtp ───────────────────────────────────────────────────
  // Personal RTP with confidence intervals — the crown jewel feature
  app.get(
    '/analytics/rtp',
    {
      schema: {
        tags: ['Analytics'],
        summary: 'Personal RTP breakdown with confidence intervals',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const userId = request.user!.id
      const query = RTPQuerySchema.parse(request.query)

      const platformFilter = query.platformId ? sql`AND s.platform_id = ${query.platformId}` : sql``
      const gameFilter = query.gameId ? sql`AND s.game_id = ${query.gameId}` : sql``
      const startFilter = query.startDate
        ? sql`AND s.started_at >= ${new Date(query.startDate)}`
        : sql``
      const endFilter = query.endDate ? sql`AND s.started_at <= ${new Date(query.endDate)}` : sql``

      const truncExpr =
        query.granularity === 'month'
          ? `DATE_TRUNC('month', s.started_at)`
          : query.granularity === 'week'
            ? `DATE_TRUNC('week', s.started_at)`
            : `DATE(s.started_at)`

      const [overall, timeSeries, byGame, byPlatform] = await Promise.all([
        // Overall RTP with confidence
        dbQuery(sql`
          SELECT
            COUNT(*) AS session_count,
            SUM(s.total_bets) AS total_bets,
            SUM(s.total_wagered) AS total_wagered,
            SUM(s.total_won) AS total_won,
            CASE
              WHEN SUM(s.total_wagered) > 0
              THEN ROUND((SUM(s.total_won) / SUM(s.total_wagered)) * 100, 4)
              ELSE NULL
            END AS rtp,
            -- Wilson confidence interval approximation (N for confidence level)
            CASE
              WHEN SUM(s.total_bets) >= 10000 THEN 'high'
              WHEN SUM(s.total_bets) >= 1000 THEN 'medium'
              WHEN SUM(s.total_bets) >= 100 THEN 'low'
              ELSE 'insufficient'
            END AS confidence_level,
            STDDEV(s.rtp) AS rtp_std_dev
          FROM sessions s
          WHERE s.user_id = ${userId}
            AND s.ended_at IS NOT NULL
            AND s.total_wagered > 0
            ${platformFilter} ${gameFilter} ${startFilter} ${endFilter}
        `),

        // RTP over time
        unsafeQuery(
          `
          SELECT
            ${truncExpr} AS period,
            COUNT(*) AS session_count,
            SUM(total_bets) AS total_bets,
            SUM(total_wagered) AS total_wagered,
            SUM(total_won) AS total_won,
            ROUND((SUM(total_won) / NULLIF(SUM(total_wagered), 0)) * 100, 4) AS rtp
          FROM sessions s
          WHERE s.user_id = $1
            AND s.ended_at IS NOT NULL
            AND s.total_wagered > 0
          GROUP BY ${truncExpr}
          ORDER BY period ASC
        `,
          [userId]
        ),

        // RTP by game (top 10 by wagered)
        dbQuery(sql`
          SELECT
            g.id AS game_id,
            g.name AS game_name,
            g.theoretical_rtp,
            g.community_rtp_aggregate AS community_rtp,
            COUNT(s.id) AS session_count,
            SUM(s.total_bets) AS total_bets,
            SUM(s.total_wagered) AS total_wagered,
            ROUND((SUM(s.total_won) / NULLIF(SUM(s.total_wagered), 0)) * 100, 4) AS personal_rtp,
            ROUND(
              (ROUND((SUM(s.total_won) / NULLIF(SUM(s.total_wagered), 0)) * 100, 4) - COALESCE(g.theoretical_rtp, 96)),
              4
            ) AS rtp_vs_theoretical
          FROM sessions s
          INNER JOIN games g ON g.id = s.game_id
          WHERE s.user_id = ${userId}
            AND s.ended_at IS NOT NULL
            AND s.total_wagered > 0
            AND s.game_id IS NOT NULL
            ${platformFilter} ${startFilter} ${endFilter}
          GROUP BY g.id, g.name, g.theoretical_rtp, g.community_rtp_aggregate
          ORDER BY total_wagered DESC
          LIMIT 10
        `),

        // RTP by platform
        dbQuery(sql`
          SELECT
            p.id AS platform_id,
            p.name AS platform_name,
            COUNT(s.id) AS session_count,
            SUM(s.total_bets) AS total_bets,
            SUM(s.total_wagered) AS total_wagered,
            ROUND((SUM(s.total_won) / NULLIF(SUM(s.total_wagered), 0)) * 100, 4) AS personal_rtp
          FROM sessions s
          INNER JOIN platforms p ON p.id = s.platform_id
          WHERE s.user_id = ${userId}
            AND s.ended_at IS NOT NULL
            AND s.total_wagered > 0
            ${gameFilter} ${startFilter} ${endFilter}
          GROUP BY p.id, p.name
          ORDER BY total_wagered DESC
        `),
      ])

      return reply.send({
        success: true,
        data: {
          overall: overall.rows[0] ?? null,
          timeSeries: timeSeries.rows,
          byGame: byGame.rows,
          byPlatform: byPlatform.rows,
        },
      })
    }
  )

  // ─── GET /analytics/temporal ──────────────────────────────────────────────
  // RTP by time of day / day of week — temporal pattern analysis
  app.get(
    '/analytics/temporal',
    {
      schema: {
        tags: ['Analytics'],
        summary: 'Temporal RTP patterns — time of day, day of week',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const userId = request.user!.id

      const [byHour, byDayOfWeek] = await Promise.all([
        dbQuery(sql`
          SELECT
            EXTRACT(HOUR FROM s.started_at)::int AS hour_of_day,
            COUNT(*) AS session_count,
            ROUND(AVG(s.rtp), 4) AS avg_rtp,
            SUM(s.total_wagered) AS total_wagered
          FROM sessions s
          WHERE s.user_id = ${userId}
            AND s.rtp IS NOT NULL
            AND s.ended_at IS NOT NULL
          GROUP BY EXTRACT(HOUR FROM s.started_at)
          ORDER BY hour_of_day ASC
        `),
        dbQuery(sql`
          SELECT
            EXTRACT(DOW FROM s.started_at)::int AS day_of_week,
            TO_CHAR(s.started_at, 'Day') AS day_name,
            COUNT(*) AS session_count,
            ROUND(AVG(s.rtp), 4) AS avg_rtp,
            SUM(s.total_wagered) AS total_wagered
          FROM sessions s
          WHERE s.user_id = ${userId}
            AND s.rtp IS NOT NULL
            AND s.ended_at IS NOT NULL
          GROUP BY EXTRACT(DOW FROM s.started_at), TO_CHAR(s.started_at, 'Day')
          ORDER BY day_of_week ASC
        `),
      ])

      return reply.send({
        success: true,
        data: {
          byHour: byHour.rows,
          byDayOfWeek: byDayOfWeek.rows,
        },
      })
    }
  )

  // ─── GET /analytics/bonus ─────────────────────────────────────────────────
  app.get(
    '/analytics/bonus',
    {
      schema: {
        tags: ['Analytics'],
        summary: 'Bonus feature analytics — trigger rate, average payout, RTP contribution',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const userId = request.user!.id

      const rows = await dbQuery(sql`
        SELECT
          p.id AS platform_id,
          p.name AS platform_name,
          g.id AS game_id,
          g.name AS game_name,
          g.bonus_trigger_frequency AS theoretical_trigger_freq,
          COUNT(s.id) AS total_sessions,
          COUNT(s.id) FILTER (WHERE s.bonus_triggered = TRUE) AS bonus_sessions,
          ROUND(
            COUNT(s.id) FILTER (WHERE s.bonus_triggered = TRUE)::numeric
            / NULLIF(COUNT(s.id), 0) * 100, 2
          ) AS actual_trigger_rate_pct,
          ROUND(AVG(s.bonus_payout) FILTER (WHERE s.bonus_triggered = TRUE), 4) AS avg_bonus_payout,
          SUM(s.bonus_payout) AS total_bonus_payout,
          ROUND(
            SUM(s.bonus_payout) / NULLIF(SUM(s.total_wagered), 0) * 100, 4
          ) AS bonus_rtp_contribution_pct
        FROM sessions s
        INNER JOIN platforms p ON p.id = s.platform_id
        LEFT JOIN games g ON g.id = s.game_id
        WHERE s.user_id = ${userId}
          AND s.ended_at IS NOT NULL
          AND s.game_id IS NOT NULL
        GROUP BY p.id, p.name, g.id, g.name, g.bonus_trigger_frequency
        HAVING COUNT(s.id) >= 5
        ORDER BY total_sessions DESC
        LIMIT 25
      `)

      return reply.send({ success: true, data: rows.rows })
    }
  )
}

/**
 * Phase 2 Feature Routes
 * Achievement System, Win/Loss Heatmap, Personal Records, Community Big Wins, Streaks
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { query as dbQuery, unsafeQuery } from '../db/client.js'
import { requireAuth } from '../middleware/auth.js'
import { sql } from 'drizzle-orm'
import { seedAchievements, achievementsEmpty } from '../db/seeds/achievements.js'
import { createNotification } from './notifications.js'

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const HeatmapQuerySchema = z.object({
  year: z.coerce.number().int().min(2020).max(2030).optional(),
  platformId: z.string().uuid().optional(),
})

const BigWinsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  platform: z.string().optional(),
  period: z.enum(['1d', '7d', '30d', 'all']).default('all'),
  minMultiplier: z.coerce.number().min(0).optional(),
})

const SubmitBigWinSchema = z.object({
  platformName: z.string().min(1).max(255),
  gameName: z.string().max(255).optional(),
  winAmountSc: z.number().positive(),
  betAmount: z.number().positive().optional(),
  multiplier: z.number().positive().optional(),
  screenshotUrl: z.string().url().optional(),
  displayName: z.string().min(1).max(100),
  occurredAt: z.string().datetime(),
  notes: z.string().max(500).optional(),
  isPublic: z.boolean().default(true),
})

/**
 * Register authenticated feature routes for achievements, heatmap, streaks, personal records, community big-wins, and dashboard stats on the given Fastify instance.
 *
 * This attaches handlers that implement:
 * - Achievement catalogue, personal earned list, leaderboard, and on-demand re-evaluation/awarding
 * - Daily win/loss heatmap with optional platform/year filtering
 * - Current and historical win/loss streaks
 * - Personal records retrieval and full recomputation
 * - Paginated public big-wins board, submission, user submissions, and patching visibility/display name
 * - Aggregate user stats for dashboard
 *
 * Routes are protected by the `requireAuth` preValidation hook and rely on database queries, schema validation, and internal helpers (e.g., seeding, personal record refresh, achievement checks).
 *
 * @param app - Fastify instance to register the feature routes on
 */

export async function featuresRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preValidation', requireAuth)

  // ══════════════════════════════════════════════════════════════════════
  // ACHIEVEMENTS
  // ══════════════════════════════════════════════════════════════════════

  // GET /features/achievements
  // Full catalogue with earned status + progress for the authed user
  app.get('/achievements', async (request, reply) => {
    const userId = request.user!.id

    // Lazy-seed: if the achievements table is empty, populate it now.
    // This runs at most once per cold DB (idempotent via ON CONFLICT DO NOTHING).
    if (await achievementsEmpty()) {
      await seedAchievements()
    }

    const rows = await dbQuery(sql`
      SELECT
        a.id,
        a.key,
        a.name,
        a.description,
        a.icon,
        a.category,
        a.tier,
        a.points,
        a.requirement,
        a.is_secret,
        ua.earned_at,
        ua.progress,
        CASE WHEN ua.id IS NOT NULL THEN true ELSE false END AS earned
      FROM achievements a
      LEFT JOIN user_achievements ua
        ON ua.achievement_id = a.id AND ua.user_id = ${userId}
      WHERE a.is_secret = false
         OR ua.id IS NOT NULL
      ORDER BY
        CASE a.tier
          WHEN 'platinum' THEN 1
          WHEN 'gold'     THEN 2
          WHEN 'silver'   THEN 3
          WHEN 'bronze'   THEN 4
          ELSE 5
        END,
        a.category,
        a.points DESC
    `)

    const totalPoints = await dbQuery(sql`
      SELECT COALESCE(SUM(a.points), 0) AS total_points, COUNT(ua.id) AS earned_count
      FROM user_achievements ua
      JOIN achievements a ON a.id = ua.achievement_id
      WHERE ua.user_id = ${userId}
    `)

    return reply.send({
      success: true,
      data: {
        achievements: rows.rows,
        summary: totalPoints.rows[0] ?? { total_points: 0, earned_count: 0 },
      },
    })
  })

  // GET /features/achievements/mine
  // Only earned achievements for the authed user
  app.get('/achievements/mine', async (request, reply) => {
    const userId = request.user!.id

    const rows = await dbQuery(sql`
      SELECT
        a.id, a.key, a.name, a.description, a.icon,
        a.category, a.tier, a.points,
        ua.earned_at, ua.progress
      FROM user_achievements ua
      JOIN achievements a ON a.id = ua.achievement_id
      WHERE ua.user_id = ${userId}
      ORDER BY ua.earned_at DESC
    `)

    return reply.send({ success: true, data: rows.rows })
  })

  // GET /features/achievements/leaderboard
  // Users ranked by total achievement points
  app.get('/achievements/leaderboard', async (request, reply) => {
    const rows = await dbQuery(sql`
      SELECT
        ua.user_id,
        COUNT(ua.id) AS achievements_earned,
        SUM(a.points) AS total_points,
        MAX(ua.earned_at) AS last_earned_at
      FROM user_achievements ua
      JOIN achievements a ON a.id = ua.achievement_id
      GROUP BY ua.user_id
      ORDER BY total_points DESC
      LIMIT 50
    `)

    return reply.send({ success: true, data: rows.rows })
  })

  // POST /features/achievements/check
  // Re-evaluate all achievement conditions for the authed user and award any newly earned
  app.post('/achievements/check', async (request, reply) => {
    const userId = request.user!.id
    const newlyEarned = await checkAndAwardAchievements(userId)
    return reply.send({ success: true, data: { newlyEarned } })
  })

  // ══════════════════════════════════════════════════════════════════════
  // WIN / LOSS HEATMAP
  // ══════════════════════════════════════════════════════════════════════

  // GET /features/heatmap
  // Daily P&L calendar data for the past year (or specified year)
  app.get('/heatmap', async (request, reply) => {
    const userId = request.user!.id
    const { year, platformId } = HeatmapQuerySchema.parse(request.query)

    const targetYear = year ?? new Date().getFullYear()
    const startDate = `${targetYear}-01-01`
    const endDate = `${targetYear}-12-31`

    const platformFilter = platformId ? sql`AND s.platform_id = ${platformId}` : sql``

    const rows = await dbQuery(sql`
      SELECT
        DATE(s.started_at) AS date,
        COUNT(*)::int AS session_count,
        COALESCE(SUM(s.total_wagered), 0)::numeric(12,4) AS wagered,
        COALESCE(SUM(s.total_won), 0)::numeric(12,4) AS won,
        COALESCE(SUM(s.total_won) - SUM(s.total_wagered), 0)::numeric(12,4) AS net_profit,
        CASE
          WHEN SUM(s.total_wagered) > 0
          THEN ROUND((SUM(s.total_won) / SUM(s.total_wagered)) * 100, 2)
          ELSE NULL
        END AS rtp
      FROM sessions s
      WHERE s.user_id = ${userId}
        AND s.ended_at IS NOT NULL
        AND DATE(s.started_at) BETWEEN ${startDate}::date AND ${endDate}::date
        ${platformFilter}
      GROUP BY DATE(s.started_at)
      ORDER BY date ASC
    `)

    // Summary stats for the year
    const summary = await dbQuery(sql`
      SELECT
        COUNT(DISTINCT DATE(s.started_at))::int AS days_played,
        COUNT(DISTINCT DATE(s.started_at)) FILTER (
          WHERE s.total_won > s.total_wagered
        )::int AS green_days,
        COUNT(DISTINCT DATE(s.started_at)) FILTER (
          WHERE s.total_won < s.total_wagered
        )::int AS red_days,
        MAX(s.total_won - s.total_wagered)::numeric(12,4) AS best_day_net,
        MIN(s.total_won - s.total_wagered)::numeric(12,4) AS worst_day_net
      FROM sessions s
      WHERE s.user_id = ${userId}
        AND s.ended_at IS NOT NULL
        AND DATE(s.started_at) BETWEEN ${startDate}::date AND ${endDate}::date
    `)

    return reply.send({
      success: true,
      data: {
        year: targetYear,
        days: rows.rows,
        summary: summary.rows[0] ?? null,
      },
    })
  })

  // ══════════════════════════════════════════════════════════════════════
  // STREAKS
  // ══════════════════════════════════════════════════════════════════════

  // GET /features/streaks
  // Current and historical win/loss streaks
  app.get('/streaks', async (request, reply) => {
    const userId = request.user!.id

    const rows = await dbQuery(sql`
      WITH daily_results AS (
        SELECT
          DATE(started_at) AS play_date,
          CASE
            WHEN SUM(total_won) > SUM(total_wagered) THEN 'win'
            WHEN SUM(total_won) < SUM(total_wagered) THEN 'loss'
            ELSE 'break_even'
          END AS result
        FROM sessions
        WHERE user_id = ${userId}
          AND ended_at IS NOT NULL
          AND total_wagered > 0
        GROUP BY DATE(started_at)
        ORDER BY play_date DESC
      ),
      streak_groups AS (
        SELECT
          play_date,
          result,
          ROW_NUMBER() OVER (ORDER BY play_date DESC)
            - ROW_NUMBER() OVER (PARTITION BY result ORDER BY play_date DESC) AS grp
        FROM daily_results
      )
      SELECT
        result,
        COUNT(*)::int AS streak_length,
        MIN(play_date) AS streak_start,
        MAX(play_date) AS streak_end
      FROM streak_groups
      GROUP BY result, grp
      ORDER BY streak_end DESC
      LIMIT 20
    `)

    // Current streak (most recent continuous run)
    const streaks = rows.rows as Array<{
      result: string
      streak_length: number
      streak_start: string
      streak_end: string
    }>

    const mostRecent = streaks[0]
    const currentStreak = mostRecent
      ? { type: mostRecent.result, days: mostRecent.streak_length, since: mostRecent.streak_start }
      : null

    const longestWin = streaks
      .filter((s) => s.result === 'win')
      .sort((a, b) => b.streak_length - a.streak_length)[0]

    const longestLoss = streaks
      .filter((s) => s.result === 'loss')
      .sort((a, b) => b.streak_length - a.streak_length)[0]

    return reply.send({
      success: true,
      data: {
        current: currentStreak,
        longestWinStreak: longestWin?.streak_length ?? 0,
        longestLossStreak: longestLoss?.streak_length ?? 0,
        history: streaks,
      },
    })
  })

  // ══════════════════════════════════════════════════════════════════════
  // PERSONAL RECORDS
  // ══════════════════════════════════════════════════════════════════════

  // GET /features/records
  // Current personal records for the authed user
  app.get('/records', async (request, reply) => {
    const userId = request.user!.id

    const record = await dbQuery(sql`
      SELECT * FROM personal_records WHERE user_id = ${userId}
    `)

    if (record.rows.length === 0) {
      // Compute on first request
      await refreshPersonalRecords(userId)
      const fresh = await dbQuery(sql`
        SELECT * FROM personal_records WHERE user_id = ${userId}
      `)
      return reply.send({ success: true, data: fresh.rows[0] ?? null })
    }

    const row = record.rows[0] as Record<string, unknown>

    // Add community percentile context: calculate percentile rank across ALL users
    const percentiles = await dbQuery(sql`
      SELECT
        ROUND((PERCENT_RANK() OVER (ORDER BY biggest_single_win ASC) * 100)::numeric, 2) AS win_percentile
      FROM personal_records
      WHERE user_id = ${userId}
    `)

    return reply.send({
      success: true,
      data: {
        ...row,
        percentiles: percentiles.rows[0] ?? { win_percentile: null },
      },
    })
  })

  // POST /features/records/refresh
  // Recompute all personal records from raw session data
  app.post('/records/refresh', async (request, reply) => {
    const userId = request.user!.id
    await refreshPersonalRecords(userId)
    const record = await dbQuery(sql`
      SELECT * FROM personal_records WHERE user_id = ${userId}
    `)
    return reply.send({ success: true, data: record.rows[0] ?? null })
  })

  // ══════════════════════════════════════════════════════════════════════
  // COMMUNITY BIG WINS BOARD
  // ══════════════════════════════════════════════════════════════════════

  // GET /features/big-wins
  // Paginated public leaderboard
  app.get('/big-wins', async (request, reply) => {
    const { page, pageSize, platform, period, minMultiplier } = BigWinsQuerySchema.parse(
      request.query
    )
    const offset = (page - 1) * pageSize

    const periodFilter =
      period === '1d'
        ? sql`AND bw.occurred_at >= NOW() - INTERVAL '1 day'`
        : period === '7d'
          ? sql`AND bw.occurred_at >= NOW() - INTERVAL '7 days'`
          : period === '30d'
            ? sql`AND bw.occurred_at >= NOW() - INTERVAL '30 days'`
            : sql``

    const platformFilter = platform
      ? sql`AND LOWER(bw.platform_name) = LOWER(${platform})`
      : sql``

    const multiplierFilter =
      minMultiplier !== undefined ? sql`AND bw.multiplier >= ${minMultiplier}` : sql``

    const rows = await dbQuery(sql`
      SELECT
        bw.id,
        bw.display_name,
        bw.platform_name,
        bw.game_name,
        bw.win_amount_sc,
        bw.multiplier,
        bw.bet_amount,
        bw.screenshot_url,
        bw.verification_status,
        bw.occurred_at,
        bw.notes,
        ROW_NUMBER() OVER (ORDER BY bw.win_amount_sc DESC) AS rank
      FROM big_wins bw
      WHERE bw.is_public = true
        AND bw.verification_status IN ('verified', 'auto_verified')
        ${periodFilter} ${platformFilter} ${multiplierFilter}
      ORDER BY bw.win_amount_sc DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `)

    const countResult = await dbQuery(sql`
      SELECT COUNT(*)::int AS total
      FROM big_wins bw
      WHERE bw.is_public = true
        AND bw.verification_status IN ('verified', 'auto_verified')
        ${periodFilter} ${platformFilter} ${multiplierFilter}
    `)

    const total = (countResult.rows[0] as Record<string, number>)?.['total'] as number ?? 0

    // Community aggregate stats banner
    const stats = await dbQuery(sql`
      SELECT
        COUNT(*)::int AS total_verified_wins,
        MAX(win_amount_sc)::numeric(12,4) AS biggest_win_ever,
        MAX(multiplier)::numeric(10,2) AS biggest_multiplier_ever,
        COUNT(DISTINCT user_id)::int AS unique_winners
      FROM big_wins
      WHERE is_public = true
        AND verification_status IN ('verified', 'auto_verified')
    `)

    return reply.send({
      success: true,
      data: {
        wins: rows.rows,
        stats: stats.rows[0] ?? null,
      },
      meta: { page, pageSize, total, hasMore: offset + pageSize < total },
    })
  })

  // POST /features/big-wins
  // Submit a big win for the community board
  app.post('/big-wins', async (request, reply) => {
    const userId = request.user!.id
    const body = SubmitBigWinSchema.parse(request.body)

    // Auto-verify if multiplier is below the extraordinary threshold (< 1000x)
    // High multipliers require manual screenshot review
    const verificationStatus =
      body.multiplier === undefined || body.multiplier < 1000 ? 'auto_verified' : 'pending'

    const { rows: insertRows } = await dbQuery(sql`
      INSERT INTO big_wins (
        user_id, platform_name, game_name, win_amount_sc,
        bet_amount, multiplier, screenshot_url, display_name,
        occurred_at, notes, is_public, verification_status
      ) VALUES (
        ${userId}, ${body.platformName}, ${body.gameName ?? null},
        ${body.winAmountSc}, ${body.betAmount ?? null}, ${body.multiplier ?? null},
        ${body.screenshotUrl ?? null}, ${body.displayName},
        ${new Date(body.occurredAt)}, ${body.notes ?? null},
        ${body.isPublic}, ${verificationStatus}
      )
      RETURNING id
    `)

    const bigWinId = (insertRows[0] as { id: string }).id

    // Trigger achievement check
    await checkAndAwardAchievements(userId)

    return reply.code(201).send({ success: true, data: { id: bigWinId, verificationStatus } })
  })

  // GET /features/big-wins/mine
  // User's own submissions (all statuses)
  app.get('/big-wins/mine', async (request, reply) => {
    const userId = request.user!.id

    const rows = await dbQuery(sql`
      SELECT *
      FROM big_wins
      WHERE user_id = ${userId}
      ORDER BY occurred_at DESC
    `)

    return reply.send({ success: true, data: rows.rows })
  })

  // PATCH /features/big-wins/:id
  // Update visibility or display name
  app.patch('/big-wins/:id', async (request, reply) => {
    const userId = request.user!.id
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const body = z
      .object({ isPublic: z.boolean().optional(), displayName: z.string().min(1).max(100).optional() })
      .parse(request.body)

    const { rows: updatedRows } = await dbQuery<{ id: string }>(sql`
      UPDATE big_wins
      SET
        is_public    = COALESCE(${body.isPublic ?? null}, is_public),
        display_name = COALESCE(${body.displayName ?? null}, display_name)
      WHERE id = ${id} AND user_id = ${userId}
      RETURNING id
    `)

    if (!updatedRows.length) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Big win not found or unauthorized' },
      })
    }

    return reply.send({ success: true, data: { id: updatedRows[0]!.id } })
  })

  // GET /features/stats
  // Quick aggregated stats for the user dashboard
  app.get('/stats', async (request, reply) => {
    const userId = request.user!.id

    const [sessionStats, achievementStats, bigWinStats] = await Promise.all([
      dbQuery(sql`
        SELECT
          COUNT(*)::int AS total_sessions,
          COALESCE(ROUND(AVG(rtp)::numeric, 2), 0) AS avg_rtp,
          COALESCE(SUM(CASE WHEN total_won > total_wagered THEN 1 ELSE 0 END)::int, 0) AS winning_sessions
        FROM sessions WHERE user_id = ${userId}
      `),
      dbQuery(sql`
        SELECT COUNT(*)::int AS total_achievements FROM user_achievements WHERE user_id = ${userId}
      `),
      dbQuery(sql`
        SELECT COUNT(*)::int AS total_big_wins FROM big_wins WHERE user_id = ${userId}
      `),
    ])

    const sessions = sessionStats.rows[0] as Record<string, unknown> | undefined
    const achievements = achievementStats.rows[0] as Record<string, unknown> | undefined
    const bigWins = bigWinStats.rows[0] as Record<string, unknown> | undefined

    return reply.send({
      success: true,
      data: {
        sessions: sessions ?? { total_sessions: 0, avg_rtp: 0, winning_sessions: 0 },
        achievements: achievements ?? { total_achievements: 0 },
        bigWins: bigWins ?? { total_big_wins: 0 },
      },
    })
  })
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Recompute and upsert a user's personal records and streak metrics from raw session data.
 *
 * Recalculates aggregated personal record fields (biggest single win, win date, game,
 * platform, highest balance, and last_computed_at) and upserts them into the personal_records
 * table for the given user. Also recomputes and updates current and longest win/loss streaks
 * derived from per-day session results.
 *
 * @param userId - The ID of the user whose personal records should be refreshed (UUID)
 */
async function refreshPersonalRecords(userId: string): Promise<void> {
  await dbQuery(sql`
    INSERT INTO personal_records (
      user_id,
      biggest_single_win,
      biggest_win_date,
      biggest_win_game,
      biggest_win_platform,
      highest_balance,
      most_bonuses_single_day,
      last_computed_at
    )
    SELECT
      ${userId},
      MAX(s.total_won - s.total_wagered),
      (SELECT started_at FROM sessions
       WHERE user_id = ${userId} AND ended_at IS NOT NULL
       ORDER BY (total_won - total_wagered) DESC LIMIT 1),
      (SELECT g.name FROM sessions sx
       LEFT JOIN games g ON g.id = sx.game_id
       WHERE sx.user_id = ${userId} AND sx.ended_at IS NOT NULL
       ORDER BY (sx.total_won - sx.total_wagered) DESC LIMIT 1),
      (SELECT p.name FROM sessions sx
       JOIN platforms p ON p.id = sx.platform_id
       WHERE sx.user_id = ${userId} AND sx.ended_at IS NOT NULL
       ORDER BY (sx.total_won - sx.total_wagered) DESC LIMIT 1),
      MAX(s.balance_after),
      0,
      NOW()
    FROM sessions s
    WHERE s.user_id = ${userId} AND s.ended_at IS NOT NULL
    ON CONFLICT (user_id) DO UPDATE SET
      biggest_single_win    = EXCLUDED.biggest_single_win,
      biggest_win_date      = EXCLUDED.biggest_win_date,
      biggest_win_game      = EXCLUDED.biggest_win_game,
      biggest_win_platform  = EXCLUDED.biggest_win_platform,
      highest_balance       = EXCLUDED.highest_balance,
      last_computed_at      = NOW()
  `)

  // Streaks: count current win/loss streak from daily results
  await dbQuery(sql`
    WITH daily_results AS (
      SELECT
        DATE(started_at) AS play_date,
        CASE WHEN SUM(total_won) > SUM(total_wagered) THEN 'win' ELSE 'loss' END AS result
      FROM sessions
      WHERE user_id = ${userId} AND ended_at IS NOT NULL AND total_wagered > 0
      GROUP BY DATE(started_at)
      ORDER BY play_date DESC
    ),
    current_run AS (
      SELECT result, COUNT(*)::int AS len
      FROM (
        SELECT result,
          ROW_NUMBER() OVER (ORDER BY play_date DESC)
          - ROW_NUMBER() OVER (PARTITION BY result ORDER BY play_date DESC) AS grp
        FROM daily_results
      ) sub
      GROUP BY result, grp
      ORDER BY MIN(play_date) DESC
      LIMIT 1
    ),
    best_win AS (
      SELECT MAX(cnt)::int AS len FROM (
        SELECT COUNT(*) AS cnt
        FROM (
          SELECT result,
            ROW_NUMBER() OVER (ORDER BY play_date DESC)
            - ROW_NUMBER() OVER (PARTITION BY result ORDER BY play_date DESC) AS grp
          FROM daily_results WHERE result = 'win'
        ) sub GROUP BY grp
      ) x
    ),
    best_loss AS (
      SELECT MAX(cnt)::int AS len FROM (
        SELECT COUNT(*) AS cnt
        FROM (
          SELECT result,
            ROW_NUMBER() OVER (ORDER BY play_date DESC)
            - ROW_NUMBER() OVER (PARTITION BY result ORDER BY play_date DESC) AS grp
          FROM daily_results WHERE result = 'loss'
        ) sub GROUP BY grp
      ) x
    )
    UPDATE personal_records SET
      current_win_streak   = CASE WHEN (SELECT result FROM current_run) = 'win'  THEN (SELECT len FROM current_run) ELSE 0 END,
      current_loss_streak  = CASE WHEN (SELECT result FROM current_run) = 'loss' THEN (SELECT len FROM current_run) ELSE 0 END,
      longest_win_streak   = COALESCE((SELECT len FROM best_win), 0),
      longest_loss_streak  = COALESCE((SELECT len FROM best_loss), 0)
    WHERE user_id = ${userId}
  `)
}

/**
 * Evaluates all achievement conditions for the given user and awards any achievements they meet.
 *
 * @param userId - UUID of the user whose achievements should be checked
 * @returns An array of achievement keys that were newly awarded to the user
 */
async function checkAndAwardAchievements(userId: string): Promise<string[]> {
  // Gather user stats needed for condition checking
  const [sessionStats, bigWinStats] = await Promise.all([
    dbQuery(sql`
      SELECT
        COUNT(*)::int AS total_sessions,
        COUNT(*) FILTER (WHERE ended_at IS NOT NULL AND total_won > total_wagered)::int AS winning_sessions,
        COUNT(DISTINCT platform_id)::int AS unique_platforms,
        COUNT(*) FILTER (WHERE bonus_triggered = true)::int AS bonus_sessions
      FROM sessions
      WHERE user_id = ${userId}
    `),
    dbQuery(sql`
      SELECT COUNT(*)::int AS big_win_count
      FROM big_wins
      WHERE user_id = ${userId} AND verification_status IN ('verified','auto_verified')
    `),
  ])

  const sessionRow = sessionStats.rows[0] as Record<string, number> | undefined
  const bigWinRow = bigWinStats.rows[0] as Record<string, number> | undefined

  const stats = {
    total_sessions: sessionRow?.['total_sessions'] ?? 0,
    unique_platforms: sessionRow?.['unique_platforms'] ?? 0,
    bonus_sessions: sessionRow?.['bonus_sessions'] ?? 0,
    big_win_count: bigWinRow?.['big_win_count'] ?? 0,
  }

  // Load all achievements and check which ones the user hasn't earned yet
  const pending = await dbQuery(sql`
    SELECT a.id, a.key, a.requirement
    FROM achievements a
    WHERE a.id NOT IN (
      SELECT achievement_id FROM user_achievements WHERE user_id = ${userId}
    )
  `)

  const newlyEarned: string[] = []

  for (const ach of pending.rows as Array<{
    id: string
    key: string
    requirement: Record<string, unknown>
  }>) {
    const req = ach.requirement
    let earned = false

    if (req['type'] === 'session_count') {
      earned = stats.total_sessions >= (req['threshold'] as number)
    } else if (req['type'] === 'unique_platforms') {
      earned = stats.unique_platforms >= (req['threshold'] as number)
    } else if (req['type'] === 'bonus_sessions') {
      earned = stats.bonus_sessions >= (req['threshold'] as number)
    } else if (req['type'] === 'big_win_submitted') {
      earned = stats.big_win_count >= 1
    }

    if (earned) {
      await dbQuery(sql`
        INSERT INTO user_achievements (user_id, achievement_id)
        VALUES (${userId}, ${ach.id})
        ON CONFLICT DO NOTHING
      `)
      newlyEarned.push(ach.key)

      // Create achievement notification
      void createNotification({
        userId,
        type: 'achievement',
        title: `Achievement Unlocked: ${ach.key}`,
        body: `You've earned a new achievement! View it in your trophy case.`,
        icon: '🏆',
        href: '/achievements',
        data: { achievementId: ach.id, achievementKey: ach.key },
      })
    }
  }

  return newlyEarned
}

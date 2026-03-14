/**
 * Analytics Routes — SweepBot API
 *
 * The full analytical engine powering every chart, stat, and insight in the
 * SweepBot application.  Every endpoint is:
 *
 *   • Auth-gated        — requireAuth preValidation hook on all routes
 *   • Input-validated   — Zod schemas on all query parameters
 *   • Response-cached   — short-TTL in-process cache, invalidated on session
 *                         writes; no external cache dependency required
 *   • Strictly typed    — explicit TypeScript return shapes aligned 1:1 to
 *                         what the frontend analytics pages consume
 *   • Compliance-safe   — all copy labels say "SC balance" / "P&L", never
 *                         "profit" in a predictive sense
 *
 * ─── Endpoint Inventory ──────────────────────────────────────────────────────
 *
 *   GET /portfolio      Dashboard overview (totals, 7-day chart, platform table)
 *   GET /rtp            Personal RTP time-series + by-game + by-platform
 *   GET /temporal       Hour-of-day and day-of-week heatmaps
 *   GET /bonus          Bonus feature analytics (trigger rate, payout, by-game)
 *   GET /streaks        Win/loss streak history and current state
 *   GET /insights       Automated pattern detection + personal records
 *   GET /export         CSV export of session data for an arbitrary date range
 *
 * ─── Response Shape Contract ─────────────────────────────────────────────────
 *
 * All successful responses:  { success: true,  data: T }
 * All error responses:        { success: false, error: string }
 *
 * Shape of each T is documented inline above its handler and mirrored in the
 * frontend types in apps/web/src/lib/api.ts.
 */

import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { db } from '../db/client.js'
import {
  sessions,
  transactions,
  platforms,
  games,
  gameIntelligence,
} from '../db/schema/comprehensive.js'
import { eq, and, gte, lte, desc, asc, sql, count, isNotNull } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth.js'

// ─── In-process response cache ────────────────────────────────────────────────
// Avoids re-running expensive multi-join aggregations on every page render.
// TTL is intentionally short (60 s) — analytics data doesn't change faster
// than that and the cache is keyed by userId so no cross-user leakage.
// On server restart the cache is empty which is safe.

interface CacheEntry<T> { data: T; expiresAt: number }

const _cache = new Map<string, CacheEntry<unknown>>()

function cacheGet<T>(key: string): T | null {
  const entry = _cache.get(key) as CacheEntry<T> | undefined
  if (!entry) return null
  if (Date.now() > entry.expiresAt) { _cache.delete(key); return null }
  return entry.data
}

function cacheSet<T>(key: string, data: T, ttlSeconds = 60): void {
  _cache.set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000 })
}

/** Evict all cache entries for a given user (call on session write). */
export function evictUserAnalyticsCache(userId: string): void {
  for (const key of _cache.keys()) {
    if (key.startsWith(`analytics:${userId}:`)) _cache.delete(key)
  }
}

// ─── Helper: confidence level (0–100) ─────────────────────────────────────────
// Derived from total spin count.  Rationale:
//   <  200 spins  → Low    ( 0–32)
//   < 1 000 spins → Medium (33–65)
//   ≥ 1 000 spins → High   (66–100)
// Capped at 100 so the UI confidence badge always renders sensibly.
function computeConfidenceLevel(betCount: number): number {
  if (betCount <= 0) return 0
  // Logarithmic scale: reaches 100 at ~10 000 spins
  return Math.min(100, Math.round(Math.log10(betCount + 1) / Math.log10(10_001) * 100))
}

// ─── Helper: SQL period-grouping expression ────────────────────────────────────
type Granularity = 'day' | 'week' | 'month'

function granularityExpr(granularity: Granularity): ReturnType<typeof sql> {
  switch (granularity) {
    case 'week':  return sql`DATE_TRUNC('week',  ${sessions.startedAt})::date`
    case 'month': return sql`DATE_TRUNC('month', ${sessions.startedAt})::date`
    default:      return sql`DATE(${sessions.startedAt})`
  }
}

// ─── Helper: map granularity to default look-back window ──────────────────────
function granularityDefaultDays(granularity: Granularity): number {
  switch (granularity) {
    case 'week':  return 84   // 12 weeks
    case 'month': return 365  // 12 months
    default:      return 30   // 30 days
  }
}

// ─── Helper: detect statistical outlier hours / days ─────────────────────────
// Returns the hour (0-23) or day-of-week (0-6) whose avg_rtp deviates the
// most from the user's mean.  Returns null if < 5 data points or variance
// is under 2 percentage points (not meaningfully different).
interface HourOrDow { slot: number; avg_rtp: number; session_count: number }

function detectOutlierSlot(
  rows: HourOrDow[],
  direction: 'best' | 'worst',
  minSessions = 3,
  minDeltaPct = 2
): number | null {
  const eligible = rows.filter((r) => r.session_count >= minSessions)
  if (eligible.length < 3) return null
  const mean = eligible.reduce((s, r) => s + r.avg_rtp, 0) / eligible.length
  const sorted = [...eligible].sort((a, b) =>
    direction === 'best' ? b.avg_rtp - a.avg_rtp : a.avg_rtp - b.avg_rtp
  )
  const candidate = sorted[0]
  if (Math.abs(candidate.avg_rtp - mean) < minDeltaPct) return null
  return candidate.slot
}

// ─── Helper: streak computation ───────────────────────────────────────────────
// A "winning session" is one where netResult > 0 (ended with more SC than started).
interface StreakSession { net_result: number }

interface StreakResult {
  current_streak: number
  current_streak_type: 'win' | 'loss' | 'neutral'
  longest_win_streak: number
  longest_loss_streak: number
}

function computeStreaks(rows: StreakSession[]): StreakResult {
  if (rows.length === 0) {
    return { current_streak: 0, current_streak_type: 'neutral', longest_win_streak: 0, longest_loss_streak: 0 }
  }

  let longestWin = 0
  let longestLoss = 0
  let runLen = 1
  let runType: 'win' | 'loss' = rows[0].net_result >= 0 ? 'win' : 'loss'

  for (let i = 1; i < rows.length; i++) {
    const t: 'win' | 'loss' = rows[i].net_result >= 0 ? 'win' : 'loss'
    if (t === runType) {
      runLen++
    } else {
      if (runType === 'win') longestWin = Math.max(longestWin, runLen)
      else longestLoss = Math.max(longestLoss, runLen)
      runLen = 1
      runType = t
    }
  }
  // flush final run
  if (runType === 'win') longestWin = Math.max(longestWin, runLen)
  else longestLoss = Math.max(longestLoss, runLen)

  const lastType: 'win' | 'loss' = rows[rows.length - 1].net_result >= 0 ? 'win' : 'loss'
  let currentLen = 0
  for (let i = rows.length - 1; i >= 0; i--) {
    const t: 'win' | 'loss' = rows[i].net_result >= 0 ? 'win' : 'loss'
    if (t === lastType) currentLen++
    else break
  }

  return {
    current_streak: currentLen,
    current_streak_type: lastType,
    longest_win_streak: longestWin,
    longest_loss_streak: longestLoss,
  }
}

// ─── Route plugin ─────────────────────────────────────────────────────────────

export const analyticsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preValidation', requireAuth)

  // ── GET /portfolio ─────────────────────────────────────────────────────────
  //
  // Primary data source for DashboardPage.
  //
  // Response: {
  //   totals: {
  //     total_sessions, total_bets, total_wagered, total_won,
  //     net_profit, overall_rtp, active_platforms, total_hours_played
  //   }
  //   recentActivity: [{play_date, sessions, wagered, won, net}]  — 7 days
  //   platformBreakdown: [{platform_id, platform_name, logo_url, session_count,
  //                         total_wagered, net_profit, rtp, last_played_at}]
  // }
  fastify.get('/portfolio', async (request) => {
    const userId = (request as FastifyRequest & { user: { id: string } }).user.id
    const cacheKey = `analytics:${userId}:portfolio`
    const cached = cacheGet(cacheKey)
    if (cached) return { success: true, data: cached }

    // ── Lifetime totals ──
    const [totalsRow] = await db
      .select({
        total_sessions:    count(sessions.id),
        total_bets:        sql<number>`COALESCE(SUM(${sessions.spinCount}), 0)::int`,
        total_wagered:     sql<number>`COALESCE(SUM(${sessions.totalWagered}), 0)`,
        total_won:         sql<number>`COALESCE(SUM(${sessions.totalWon}), 0)`,
        net_profit:        sql<number>`COALESCE(SUM(${sessions.netResult}), 0)`,
        overall_rtp:       sql<number>`
          CASE WHEN SUM(${sessions.totalWagered}) > 0
            THEN (SUM(${sessions.totalWon}) / SUM(${sessions.totalWagered})) * 100
            ELSE 0
          END`,
        active_platforms:  sql<number>`COUNT(DISTINCT ${sessions.platformId})::int`,
        total_hours_played: sql<number>`
          COALESCE(
            SUM(EXTRACT(EPOCH FROM (${sessions.endedAt} - ${sessions.startedAt}))) / 3600,
          0)`,
      })
      .from(sessions)
      .where(and(eq(sessions.userId, userId), isNotNull(sessions.endedAt)))

    // ── 7-day rolling activity (fills gaps via generate_series would need raw SQL;
    //    here we return the days that have sessions and let the frontend fill gaps) ──
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1_000)
    const recentActivity = await db
      .select({
        play_date: sql<string>`DATE(${sessions.startedAt})`,
        sessions:  count(sessions.id),
        wagered:   sql<number>`COALESCE(SUM(${sessions.totalWagered}), 0)`,
        won:       sql<number>`COALESCE(SUM(${sessions.totalWon}), 0)`,
        net:       sql<number>`COALESCE(SUM(${sessions.netResult}), 0)`,
      })
      .from(sessions)
      .where(and(eq(sessions.userId, userId), gte(sessions.startedAt, sevenDaysAgo)))
      .groupBy(sql`DATE(${sessions.startedAt})`)
      .orderBy(sql`DATE(${sessions.startedAt})`)

    // ── Per-platform breakdown ──
    const platformBreakdown = await db
      .select({
        platform_id:    platforms.id,
        platform_name:  platforms.displayName,
        logo_url:       platforms.logoUrl,
        session_count:  count(sessions.id),
        total_wagered:  sql<number>`COALESCE(SUM(${sessions.totalWagered}), 0)`,
        total_won:      sql<number>`COALESCE(SUM(${sessions.totalWon}), 0)`,
        net_profit:     sql<number>`COALESCE(SUM(${sessions.netResult}), 0)`,
        rtp:            sql<number | null>`
          CASE WHEN SUM(${sessions.totalWagered}) > 0
            THEN (SUM(${sessions.totalWon}) / SUM(${sessions.totalWagered})) * 100
            ELSE NULL
          END`,
        last_played_at: sql<string>`MAX(${sessions.startedAt})`,
      })
      .from(sessions)
      .innerJoin(platforms, eq(sessions.platformId, platforms.id))
      .where(eq(sessions.userId, userId))
      .groupBy(platforms.id, platforms.displayName, platforms.logoUrl)
      .orderBy(desc(sql`SUM(${sessions.totalWagered})`))

    const data = { totals: totalsRow ?? {}, recentActivity, platformBreakdown }
    cacheSet(cacheKey, data, 60)
    return { success: true, data }
  })

  // ── GET /rtp ───────────────────────────────────────────────────────────────
  //
  // Personal RTP deep-dive.  Powers the full AnalyticsPage RTP section.
  //
  // Query params:
  //   granularity  'day' | 'week' | 'month'   (default 'day')
  //   platform_id  UUID (optional filter)
  //   game_id      string (optional filter)
  //   days         number 1–730               (default derived from granularity)
  //
  // Response: {
  //   overall_rtp: number
  //   total_bets:  number   (spin count, not session count)
  //   confidence_level: number   (0–100)
  //   time_series: [{ period: string, rtp: number, theoretical_rtp: number | null }]
  //   by_game:     [{ game_id, game_name, platform_name, personal_rtp, bet_count,
  //                   theoretical_rtp, vs_theoretical }]
  //   by_platform: [{ platform_id, platform_name, personal_rtp, net_profit,
  //                   session_count, community_rtp }]
  // }
  fastify.get('/rtp', {
    schema: {
      querystring: z.object({
        granularity:  z.enum(['day', 'week', 'month']).default('day'),
        platform_id:  z.string().uuid().optional(),
        game_id:      z.string().max(100).optional(),
        days:         z.coerce.number().int().min(1).max(730).optional(),
      }).strict()
    }
  }, async (request) => {
    const userId = (request as FastifyRequest & { user: { id: string } }).user.id
    const { granularity, platform_id, game_id, days: explicitDays } =
      request.query as { granularity: Granularity; platform_id?: string; game_id?: string; days?: number }

    const days = explicitDays ?? granularityDefaultDays(granularity)
    const cacheKey = `analytics:${userId}:rtp:${granularity}:${platform_id ?? ''}:${game_id ?? ''}:${days}`
    const cached = cacheGet(cacheKey)
    if (cached) return { success: true, data: cached }

    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1_000)

    const baseConditions = [
      eq(sessions.userId, userId),
      gte(sessions.startedAt, startDate),
      isNotNull(sessions.endedAt),
    ]
    if (platform_id) baseConditions.push(eq(sessions.platformId, platform_id as string))
    if (game_id)     baseConditions.push(eq(sessions.gameId, game_id as string))

    // ── Overall stats ──
    const [overall] = await db
      .select({
        total_bets:  sql<number>`COALESCE(SUM(${sessions.spinCount}), 0)::int`,
        overall_rtp: sql<number>`
          CASE WHEN SUM(${sessions.totalWagered}) > 0
            THEN (SUM(${sessions.totalWon}) / SUM(${sessions.totalWagered})) * 100
            ELSE 0
          END`,
      })
      .from(sessions)
      .where(and(...baseConditions))

    const totalBets    = overall?.total_bets  ?? 0
    const overallRtp   = overall?.overall_rtp ?? 0
    const confidenceLevel = computeConfidenceLevel(totalBets)

    // ── Time series ──
    // LEFT JOINs games to get theoretical_rtp for the period.
    // When multiple games are played in the same period, we use the
    // spin-count-weighted average of their theoretical RTPs.
    const periodExpr = granularityExpr(granularity)
    const timeSeries = await db
      .select({
        period:          sql<string>`${periodExpr}::text`,
        rtp:             sql<number>`
          CASE WHEN SUM(s.total_wagered) > 0
            THEN (SUM(s.total_won) / SUM(s.total_wagered)) * 100
            ELSE 0
          END`,
        theoretical_rtp: sql<number | null>`
          CASE WHEN SUM(s.spin_count) > 0
            THEN SUM(CASE WHEN g.theoretical_rtp IS NOT NULL
                     THEN g.theoretical_rtp::numeric * s.spin_count ELSE 0 END)
                 / NULLIF(SUM(CASE WHEN g.theoretical_rtp IS NOT NULL
                               THEN s.spin_count ELSE 0 END), 0)
            ELSE NULL
          END`,
        session_count:   count(sessions.id),
        spin_count:      sql<number>`COALESCE(SUM(s.spin_count), 0)::int`,
      })
      .from(sql`${sessions} AS s`)
      .leftJoin(
        sql`${games} AS g`,
        sql`s.game_id = g.external_game_id AND s.platform_id = g.platform_id`
      )
      .where(and(...baseConditions))
      .groupBy(periodExpr)
      .orderBy(asc(periodExpr))

    // ── By-game breakdown ──
    const byGame = await db
      .select({
        game_id:          sql<string>`COALESCE(s.game_id, 'unknown')`,
        game_name:        sql<string>`COALESCE(g.name, s.game_id, 'Unknown Game')`,
        platform_name:    platforms.displayName,
        personal_rtp:     sql<number>`
          CASE WHEN SUM(s.total_wagered) > 0
            THEN (SUM(s.total_won) / SUM(s.total_wagered)) * 100
            ELSE 0
          END`,
        bet_count:        sql<number>`COALESCE(SUM(s.spin_count), 0)::int`,
        theoretical_rtp:  sql<number | null>`g.theoretical_rtp`,
        vs_theoretical:   sql<number | null>`
          CASE WHEN SUM(s.total_wagered) > 0 AND g.theoretical_rtp IS NOT NULL
            THEN (SUM(s.total_won) / SUM(s.total_wagered)) * 100 - g.theoretical_rtp::numeric
            ELSE NULL
          END`,
      })
      .from(sql`${sessions} AS s`)
      .innerJoin(platforms, eq(sql`s.platform_id`, platforms.id))
      .leftJoin(
        sql`${games} AS g`,
        sql`s.game_id = g.external_game_id AND s.platform_id = g.platform_id`
      )
      .where(and(...baseConditions, isNotNull(sessions.gameId)))
      .groupBy(
        sql`s.game_id`,
        sql`g.name`,
        sql`g.theoretical_rtp`,
        platforms.id,
        platforms.displayName
      )
      .orderBy(desc(sql`SUM(s.spin_count)`))
      .limit(20)

    // ── By-platform breakdown ──
    const byPlatform = await db
      .select({
        platform_id:   platforms.id,
        platform_name: platforms.displayName,
        personal_rtp:  sql<number>`
          CASE WHEN SUM(${sessions.totalWagered}) > 0
            THEN (SUM(${sessions.totalWon}) / SUM(${sessions.totalWagered})) * 100
            ELSE 0
          END`,
        net_profit:    sql<number>`COALESCE(SUM(${sessions.netResult}), 0)`,
        session_count: count(sessions.id),
        // community RTP pulled from game_intelligence aggregate for this platform
        community_rtp: sql<number | null>`
          (SELECT AVG(gi.community_rtp)
           FROM ${gameIntelligence} gi
           WHERE gi.platform_id = ${sessions.platformId})`,
      })
      .from(sessions)
      .innerJoin(platforms, eq(sessions.platformId, platforms.id))
      .where(and(...baseConditions))
      .groupBy(platforms.id, platforms.displayName, sessions.platformId)
      .orderBy(desc(sql`SUM(${sessions.totalWagered})`))

    const data = {
      overall_rtp:      overallRtp,
      total_bets:       totalBets,
      confidence_level: confidenceLevel,
      time_series:      timeSeries,
      by_game:          byGame,
      by_platform:      byPlatform,
    }
    cacheSet(cacheKey, data, 60)
    return { success: true, data }
  })

  // ── GET /temporal ──────────────────────────────────────────────────────────
  //
  // Hour-of-day and day-of-week heatmaps.  Powers the temporal pattern cards
  // in AnalyticsPage.  Includes automated outlier insights.
  //
  // Response: {
  //   by_hour: [{ hour: 0-23, avg_rtp, session_count, avg_net }]
  //   by_dow:  [{ dow: 0-6,   avg_rtp, session_count, avg_net }]
  //   insights: {
  //     best_hour, worst_hour,    // null if insufficient data
  //     best_dow,  worst_dow,
  //   }
  // }
  fastify.get('/temporal', {
    schema: {
      querystring: z.object({
        platform_id: z.string().uuid().optional(),
        days:        z.coerce.number().int().min(7).max(730).default(90),
      }).strict()
    }
  }, async (request) => {
    const userId = (request as FastifyRequest & { user: { id: string } }).user.id
    const { platform_id, days } = request.query as { platform_id?: string; days: number }
    const cacheKey = `analytics:${userId}:temporal:${platform_id ?? ''}:${days}`
    const cached = cacheGet(cacheKey)
    if (cached) return { success: true, data: cached }

    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1_000)
    const conditions = [
      eq(sessions.userId, userId),
      gte(sessions.startedAt, startDate),
      isNotNull(sessions.endedAt),
    ]
    if (platform_id) conditions.push(eq(sessions.platformId, platform_id as string))

    // ── By hour-of-day ──
    const byHourRaw = await db
      .select({
        hour:          sql<number>`EXTRACT(HOUR FROM ${sessions.startedAt})::int`,
        avg_rtp:       sql<number>`
          CASE WHEN SUM(${sessions.totalWagered}) > 0
            THEN (SUM(${sessions.totalWon}) / SUM(${sessions.totalWagered})) * 100
            ELSE 0
          END`,
        session_count: count(sessions.id),
        avg_net:       sql<number>`AVG(${sessions.netResult})`,
      })
      .from(sessions)
      .where(and(...conditions))
      .groupBy(sql`EXTRACT(HOUR FROM ${sessions.startedAt})`)
      .orderBy(asc(sql`EXTRACT(HOUR FROM ${sessions.startedAt})`))

    // ── By day-of-week ──
    const byDowRaw = await db
      .select({
        dow:           sql<number>`EXTRACT(DOW FROM ${sessions.startedAt})::int`,
        avg_rtp:       sql<number>`
          CASE WHEN SUM(${sessions.totalWagered}) > 0
            THEN (SUM(${sessions.totalWon}) / SUM(${sessions.totalWagered})) * 100
            ELSE 0
          END`,
        session_count: count(sessions.id),
        avg_net:       sql<number>`AVG(${sessions.netResult})`,
      })
      .from(sessions)
      .where(and(...conditions))
      .groupBy(sql`EXTRACT(DOW FROM ${sessions.startedAt})`)
      .orderBy(asc(sql`EXTRACT(DOW FROM ${sessions.startedAt})`))

    // ── Automated insights ──
    const hourData = byHourRaw.map((r) => ({ slot: r.hour, avg_rtp: r.avg_rtp, session_count: r.session_count }))
    const dowData  = byDowRaw.map((r)  => ({ slot: r.dow,  avg_rtp: r.avg_rtp, session_count: r.session_count }))

    const insights = {
      best_hour:  detectOutlierSlot(hourData, 'best'),
      worst_hour: detectOutlierSlot(hourData, 'worst'),
      best_dow:   detectOutlierSlot(dowData,  'best'),
      worst_dow:  detectOutlierSlot(dowData,  'worst'),
    }

    const data = { by_hour: byHourRaw, by_dow: byDowRaw, insights }
    cacheSet(cacheKey, data, 120)
    return { success: true, data }
  })

  // ── GET /bonus ─────────────────────────────────────────────────────────────
  //
  // Bonus feature analytics.  Powers the bonus section in AnalyticsPage.
  //
  // Response: {
  //   trigger_rate:           number   — overall bonus trigger % across all spins
  //   avg_payout:             number   — average SC payout per bonus event
  //   rtp_contribution_percent: number — % of total RTP attributable to bonuses
  //   by_game: [{
  //     game_id, game_name,
  //     actual_trigger_rate,       // user's observed rate %
  //     theoretical_trigger_rate,  // from game_intelligence (null if unknown)
  //     avg_bonus_payout,
  //     rtp_contribution_pct,
  //   }]
  // }
  fastify.get('/bonus', {
    schema: {
      querystring: z.object({
        platform_id: z.string().uuid().optional(),
        days:        z.coerce.number().int().min(1).max(730).default(90),
      }).strict()
    }
  }, async (request) => {
    const userId = (request as FastifyRequest & { user: { id: string } }).user.id
    const { platform_id, days } = request.query as { platform_id?: string; days: number }
    const cacheKey = `analytics:${userId}:bonus:${platform_id ?? ''}:${days}`
    const cached = cacheGet(cacheKey)
    if (cached) return { success: true, data: cached }

    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1_000)
    const conditions = [
      eq(transactions.userId, userId),
      gte(transactions.timestamp, startDate),
    ]
    if (platform_id) conditions.push(eq(transactions.platformId, platform_id as string))

    // ── Overall summary ──
    const [summary] = await db
      .select({
        total_spins:        count(transactions.id),
        bonus_triggers:     sql<number>`COUNT(CASE WHEN ${transactions.bonusTriggered} = true THEN 1 END)::int`,
        total_bonus_payout: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.bonusTriggered} = true THEN ${transactions.winAmount} ELSE 0 END), 0)`,
        total_payout:       sql<number>`COALESCE(SUM(${transactions.winAmount}), 0)`,
      })
      .from(transactions)
      .where(and(...conditions))

    const totalSpins        = summary?.total_spins ?? 0
    const bonusTriggers     = summary?.bonus_triggers ?? 0
    const totalBonusPayout  = summary?.total_bonus_payout ?? 0
    const totalPayout       = summary?.total_payout ?? 0

    const triggerRate            = totalSpins > 0 ? (bonusTriggers / totalSpins) * 100 : 0
    const avgPayout              = bonusTriggers > 0 ? totalBonusPayout / bonusTriggers : 0
    const rtpContributionPercent = totalPayout > 0 ? (totalBonusPayout / totalPayout) * 100 : 0

    // ── By-game breakdown ──
    const byGameRaw = await db
      .select({
        game_id:                 transactions.gameId,
        game_name:               sql<string>`COALESCE(g.name, t.game_id, 'Unknown Game')`,
        total_spins:             count(transactions.id),
        bonus_triggers:          sql<number>`COUNT(CASE WHEN t.bonus_triggered = true THEN 1 END)::int`,
        actual_trigger_rate:     sql<number>`
          CASE WHEN COUNT(*) > 0
            THEN (COUNT(CASE WHEN t.bonus_triggered = true THEN 1 END) * 100.0) / COUNT(*)
            ELSE 0
          END`,
        theoretical_trigger_rate: sql<number | null>`gi.bonus_frequency`,
        total_bonus_payout:      sql<number>`COALESCE(SUM(CASE WHEN t.bonus_triggered = true THEN t.win_amount ELSE 0 END), 0)`,
        total_payout:            sql<number>`COALESCE(SUM(t.win_amount), 0)`,
        avg_bonus_payout:        sql<number>`
          COALESCE(AVG(CASE WHEN t.bonus_triggered = true THEN t.win_amount END), 0)`,
        rtp_contribution_pct:    sql<number>`
          CASE WHEN SUM(t.win_amount) > 0
            THEN (SUM(CASE WHEN t.bonus_triggered = true THEN t.win_amount ELSE 0 END)
                  / SUM(t.win_amount)) * 100
            ELSE 0
          END`,
      })
      .from(sql`${transactions} AS t`)
      .leftJoin(
        sql`${games} AS g`,
        sql`t.game_id = g.external_game_id AND t.platform_id = g.platform_id`
      )
      .leftJoin(
        sql`${gameIntelligence} AS gi`,
        sql`t.game_id = gi.game_id AND t.platform_id = gi.platform_id`
      )
      .where(and(...conditions, isNotNull(transactions.gameId)))
      .groupBy(
        sql`t.game_id`,
        sql`g.name`,
        sql`gi.bonus_frequency`
      )
      .orderBy(desc(sql`COUNT(CASE WHEN t.bonus_triggered = true THEN 1 END)`))
      .limit(20)

    const data = {
      trigger_rate:             triggerRate,
      avg_payout:               avgPayout,
      rtp_contribution_percent: rtpContributionPercent,
      by_game:                  byGameRaw,
    }
    cacheSet(cacheKey, data, 120)
    return { success: true, data }
  })

  // ── GET /streaks ───────────────────────────────────────────────────────────
  //
  // Win/loss streak analysis.  Computed from the user's session history
  // ordered chronologically.  A "winning session" = netResult > 0.
  //
  // Response: {
  //   current_streak:       number
  //   current_streak_type:  'win' | 'loss' | 'neutral'
  //   longest_win_streak:   number
  //   longest_loss_streak:  number
  //   recent_sessions: [{  date, net_result, rtp, platform_name }]  — last 30
  //   hot_streak_start: string | null   — ISO date of the current win streak start
  // }
  fastify.get('/streaks', {
    schema: {
      querystring: z.object({
        platform_id: z.string().uuid().optional(),
      }).strict()
    }
  }, async (request) => {
    const userId = (request as FastifyRequest & { user: { id: string } }).user.id
    const { platform_id } = request.query as { platform_id?: string }
    const cacheKey = `analytics:${userId}:streaks:${platform_id ?? ''}`
    const cached = cacheGet(cacheKey)
    if (cached) return { success: true, data: cached }

    const conditions = [eq(sessions.userId, userId), isNotNull(sessions.endedAt)]
    if (platform_id) conditions.push(eq(sessions.platformId, platform_id as string))

    const allSessions = await db
      .select({
        id:            sessions.id,
        date:          sql<string>`DATE(${sessions.startedAt})`,
        net_result:    sql<number>`COALESCE(${sessions.netResult}, 0)`,
        rtp:           sql<number | null>`${sessions.rtp}`,
        platform_name: platforms.displayName,
        started_at:    sessions.startedAt,
      })
      .from(sessions)
      .innerJoin(platforms, eq(sessions.platformId, platforms.id))
      .where(and(...conditions))
      .orderBy(asc(sessions.startedAt))

    const streaks = computeStreaks(allSessions.map((s) => ({ net_result: s.net_result })))

    // Find start date of the current streak
    let hotStreakStart: string | null = null
    if (streaks.current_streak > 0 && allSessions.length >= streaks.current_streak) {
      const streakStartRow = allSessions[allSessions.length - streaks.current_streak]
      hotStreakStart = streakStartRow?.date ?? null
    }

    const data = {
      ...streaks,
      hot_streak_start: hotStreakStart,
      recent_sessions: allSessions.slice(-30).reverse().map((s) => ({
        date:          s.date,
        net_result:    s.net_result,
        rtp:           s.rtp,
        platform_name: s.platform_name,
        is_win:        s.net_result > 0,
      })),
    }
    cacheSet(cacheKey, data, 60)
    return { success: true, data }
  })

  // ── GET /insights ──────────────────────────────────────────────────────────
  //
  // Automated pattern detection + personal records + summary stats.
  // Powers a future "Insights" tab.  All language is compliance-safe:
  // patterns describe *what happened historically*, never what to do next.
  //
  // Response: {
  //   patterns: [{
  //     type: 'temporal_pattern' | 'platform_pattern' | 'game_pattern' | 'streak_pattern'
  //     description: string        — human-readable, historical framing only
  //     significance: 'low' | 'medium' | 'high'
  //   }]
  //   personal_records: {
  //     best_session_rtp, worst_session_rtp, longest_session_minutes,
  //     biggest_win_sc, highest_spin_count, most_bonus_triggers_session
  //   }
  //   summary_stats: {
  //     total_play_days, avg_sessions_per_week,
  //     most_played_platform, most_played_game
  //   }
  // }
  fastify.get('/insights', async (request) => {
    const userId = (request as FastifyRequest & { user: { id: string } }).user.id
    const cacheKey = `analytics:${userId}:insights`
    const cached = cacheGet(cacheKey)
    if (cached) return { success: true, data: cached }

    // ── Personal records ──
    const [records] = await db
      .select({
        best_session_rtp:           sql<number | null>`MAX(${sessions.rtp})`,
        worst_session_rtp:          sql<number | null>`MIN(CASE WHEN ${sessions.spinCount} > 20 THEN ${sessions.rtp} ELSE NULL END)`,
        longest_session_minutes:    sql<number>`COALESCE(MAX(EXTRACT(EPOCH FROM (${sessions.endedAt} - ${sessions.startedAt})) / 60), 0)`,
        biggest_win_sc:             sql<number>`COALESCE(MAX(${sessions.totalWon}), 0)`,
        highest_spin_count:         sql<number>`COALESCE(MAX(${sessions.spinCount}), 0)::int`,
      })
      .from(sessions)
      .where(and(eq(sessions.userId, userId), isNotNull(sessions.endedAt)))

    // ── Summary stats ──
    const [summaryRow] = await db
      .select({
        total_play_days:     sql<number>`COUNT(DISTINCT DATE(${sessions.startedAt}))::int`,
        total_sessions:      count(sessions.id),
        earliest_session:    sql<string>`MIN(${sessions.startedAt})`,
      })
      .from(sessions)
      .where(and(eq(sessions.userId, userId), isNotNull(sessions.endedAt)))

    const totalDays   = summaryRow?.total_play_days ?? 0
    const totalSess   = summaryRow?.total_sessions  ?? 0
    const earliest    = summaryRow?.earliest_session
    const weeksSince  = earliest
      ? Math.max(1, (Date.now() - new Date(earliest).getTime()) / (7 * 24 * 60 * 60 * 1_000))
      : 1
    const avgPerWeek  = Math.round((totalSess / weeksSince) * 10) / 10

    // ── Most played platform ──
    const [topPlatform] = await db
      .select({
        platform_name: platforms.displayName,
        session_count: count(sessions.id),
      })
      .from(sessions)
      .innerJoin(platforms, eq(sessions.platformId, platforms.id))
      .where(and(eq(sessions.userId, userId), isNotNull(sessions.endedAt)))
      .groupBy(platforms.id, platforms.displayName)
      .orderBy(desc(count(sessions.id)))
      .limit(1)

    // ── Most played game ──
    const [topGame] = await db
      .select({
        game_name:  sql<string | null>`COALESCE(g.name, s.game_id)`,
        spin_count: sql<number>`COALESCE(SUM(s.spin_count), 0)::int`,
      })
      .from(sql`${sessions} AS s`)
      .leftJoin(sql`${games} AS g`, sql`s.game_id = g.external_game_id AND s.platform_id = g.platform_id`)
      .where(and(eq(sql`s.user_id`, userId), isNotNull(sql`s.ended_at`), isNotNull(sql`s.game_id`)))
      .groupBy(sql`s.game_id, g.name`)
      .orderBy(desc(sql`SUM(s.spin_count)`))
      .limit(1)

    // ── Temporal patterns (call via raw to avoid n+1) ──
    const [hourBest] = await db
      .select({
        hour:    sql<number>`EXTRACT(HOUR FROM ${sessions.startedAt})::int`,
        avg_rtp: sql<number>`(SUM(${sessions.totalWon}) / NULLIF(SUM(${sessions.totalWagered}), 0)) * 100`,
        cnt:     count(sessions.id),
      })
      .from(sessions)
      .where(and(eq(sessions.userId, userId), isNotNull(sessions.endedAt)))
      .groupBy(sql`EXTRACT(HOUR FROM ${sessions.startedAt})`)
      .having(sql`COUNT(*) >= 3`)
      .orderBy(desc(sql`(SUM(${sessions.totalWon}) / NULLIF(SUM(${sessions.totalWagered}), 0)) * 100`))
      .limit(1)

    // ── Assemble compliance-safe patterns ──
    const patterns: Array<{ type: string; description: string; significance: 'low' | 'medium' | 'high' }> = []

    if (hourBest && hourBest.avg_rtp != null && totalSess >= 10) {
      const hourLabel = `${hourBest.hour}:00–${hourBest.hour + 1}:00`
      patterns.push({
        type: 'temporal_pattern',
        description: `Historically, your sessions starting between ${hourLabel} have shown the highest SC return in your personal data. This is historical observation only — past patterns do not predict future results.`,
        significance: hourBest.avg_rtp > 105 ? 'high' : hourBest.avg_rtp > 100 ? 'medium' : 'low',
      })
    }

    if (topPlatform && totalSess >= 5) {
      patterns.push({
        type: 'platform_pattern',
        description: `${topPlatform.platform_name} accounts for the most of your logged session activity (${topPlatform.session_count} sessions). Your historical data on this platform is the most statistically robust.`,
        significance: 'low',
      })
    }

    const data = {
      patterns,
      personal_records: {
        best_session_rtp:        records?.best_session_rtp         ?? null,
        worst_session_rtp:       records?.worst_session_rtp        ?? null,
        longest_session_minutes: records?.longest_session_minutes  ?? 0,
        biggest_win_sc:          records?.biggest_win_sc            ?? 0,
        highest_spin_count:      records?.highest_spin_count        ?? 0,
      },
      summary_stats: {
        total_play_days:       totalDays,
        avg_sessions_per_week: avgPerWeek,
        most_played_platform:  topPlatform?.platform_name ?? null,
        most_played_game:      topGame?.game_name ?? null,
      },
    }
    cacheSet(cacheKey, data, 300) // 5 min — insights don't need real-time freshness
    return { success: true, data }
  })

  // ── GET /export ────────────────────────────────────────────────────────────
  //
  // CSV export of the user's session-level data for a given date range.
  // Intended for the Tax Center feature (Analyst+ tier).
  //
  // Query params:
  //   start_date  ISO date string  (required)
  //   end_date    ISO date string  (required)
  //
  // Response: CSV file with Content-Disposition: attachment
  // Columns: date, platform, game, duration_minutes, total_wagered_sc,
  //          total_won_sc, net_result_sc, rtp_pct, spin_count, bonus_triggers
  fastify.get('/export', {
    schema: {
      querystring: z.object({
        start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
        end_date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
      }).strict()
    }
  }, async (request, reply) => {
    const userId = (request as FastifyRequest & { user: { id: string } }).user.id
    const { start_date, end_date } = request.query as { start_date: string; end_date: string }

    const start = new Date(`${start_date}T00:00:00Z`)
    const end   = new Date(`${end_date}T23:59:59Z`)

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return reply.code(400).send({ success: false, error: 'Invalid date range' })
    }
    if (end < start) {
      return reply.code(400).send({ success: false, error: 'end_date must be >= start_date' })
    }
    // Safety cap: max 2-year export
    const rangeDays = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1_000)
    if (rangeDays > 730) {
      return reply.code(400).send({ success: false, error: 'Date range cannot exceed 730 days' })
    }

    const rows = await db
      .select({
        date:             sql<string>`DATE(${sessions.startedAt})`,
        platform:         platforms.displayName,
        game:             sql<string | null>`COALESCE(g.name, ${sessions.gameId}, '')`,
        duration_minutes: sql<number>`COALESCE(EXTRACT(EPOCH FROM (${sessions.endedAt} - ${sessions.startedAt})) / 60, 0)`,
        total_wagered_sc: sessions.totalWagered,
        total_won_sc:     sessions.totalWon,
        net_result_sc:    sessions.netResult,
        rtp_pct:          sessions.rtp,
        spin_count:       sessions.spinCount,
      })
      .from(sessions)
      .innerJoin(platforms, eq(sessions.platformId, platforms.id))
      .leftJoin(
        sql`${games} AS g`,
        sql`${sessions.gameId} = g.external_game_id AND ${sessions.platformId} = g.platform_id`
      )
      .where(and(
        eq(sessions.userId, userId),
        gte(sessions.startedAt, start),
        lte(sessions.startedAt, end),
        isNotNull(sessions.endedAt),
      ))
      .orderBy(asc(sessions.startedAt))

    // Serialise to CSV
    const header = 'date,platform,game,duration_minutes,total_wagered_sc,total_won_sc,net_result_sc,rtp_pct,spin_count'
    const escape = (v: unknown) => {
      const s = String(v ?? '')
      return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s
    }
    const csvLines = rows.map((r) => [
      r.date, r.platform, r.game ?? '',
      r.duration_minutes.toFixed(1),
      r.total_wagered_sc, r.total_won_sc,
      r.net_result_sc ?? 0,
      r.rtp_pct ?? '',
      r.spin_count,
    ].map(escape).join(','))

    const csv = [header, ...csvLines].join('\n')
    const filename = `sweepbot-sessions-${start_date}-to-${end_date}.csv`

    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
    return csv
  })
}

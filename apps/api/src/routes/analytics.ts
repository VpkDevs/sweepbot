import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { db } from '../db/client.js'
import { sessions, transactions, platforms } from '../db/schema/comprehensive.js'
import { eq, and, gte, desc, sql, count } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth.js'

export const analyticsRoutes: FastifyPluginAsync = async (fastify) => {
  // Require auth for all analytics routes
  fastify.addHook('preValidation', requireAuth)

  // Portfolio overview - main dashboard data
  fastify.get('/portfolio', async (request, reply) => {
    const userId = request.user!.id

    // Get totals
    const totals = await db
      .select({
        total_sessions: count(sessions.id),
        total_wagered: sql<number>`COALESCE(SUM(${sessions.totalWagered}), 0)`,
        total_won: sql<number>`COALESCE(SUM(${sessions.totalWon}), 0)`,
        net_profit: sql<number>`COALESCE(SUM(${sessions.netResult}), 0)`,
        overall_rtp: sql<number>`CASE WHEN SUM(${sessions.totalWagered}) > 0 THEN (SUM(${sessions.totalWon}) / SUM(${sessions.totalWagered})) * 100 ELSE 0 END`,
        total_bets: sql<number>`COALESCE(SUM(${sessions.spinCount}), 0)`,
        active_platforms: sql<number>`COUNT(DISTINCT ${sessions.platformId})`,
        total_hours_played: sql<number>`COALESCE(SUM(EXTRACT(EPOCH FROM (${sessions.endedAt} - ${sessions.startedAt}))) / 3600, 0)`
      })
      .from(sessions)
      .where(eq(sessions.userId, userId))

    // Recent 7-day activity
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const recentActivity = await db
      .select({
        play_date: sql<string>`DATE(${sessions.startedAt})`,
        sessions: count(sessions.id),
        wagered: sql<number>`COALESCE(SUM(${sessions.totalWagered}), 0)`,
        won: sql<number>`COALESCE(SUM(${sessions.totalWon}), 0)`,
        net: sql<number>`COALESCE(SUM(${sessions.netResult}), 0)`
      })
      .from(sessions)
      .where(and(
        eq(sessions.userId, userId),
        gte(sessions.startedAt, sevenDaysAgo)
      ))
      .groupBy(sql`DATE(${sessions.startedAt})`)
      .orderBy(sql`DATE(${sessions.startedAt})`)

    // Platform breakdown
    const platformBreakdown = await db
      .select({
        platform_id: platforms.id,
        platform_name: platforms.displayName,
        logo_url: platforms.logoUrl,
        session_count: count(sessions.id),
        total_wagered: sql<number>`COALESCE(SUM(${sessions.totalWagered}), 0)`,
        total_won: sql<number>`COALESCE(SUM(${sessions.totalWon}), 0)`,
        net_profit: sql<number>`COALESCE(SUM(${sessions.netResult}), 0)`,
        rtp: sql<number>`CASE WHEN SUM(${sessions.totalWagered}) > 0 THEN (SUM(${sessions.totalWon}) / SUM(${sessions.totalWagered})) * 100 ELSE NULL END`,
        last_played_at: sql<string>`MAX(${sessions.startedAt})`
      })
      .from(sessions)
      .innerJoin(platforms, eq(sessions.platformId, platforms.id))
      .where(eq(sessions.userId, userId))
      .groupBy(platforms.id, platforms.displayName, platforms.logoUrl)
      .orderBy(desc(sql`SUM(${sessions.totalWagered})`))

    return {
      success: true,
      data: {
        totals: totals[0] || {},
        recentActivity,
        platformBreakdown
      }
    }
  })

  // RTP analysis with confidence intervals
  fastify.get('/rtp', {
    schema: {
      querystring: z.object({
        platform_id: z.string().uuid().optional(),
        game_id: z.string().optional(),
        days: z.coerce.number().min(1).max(365).default(30)
      })
    }
  }, async (request, reply) => {
    const userId = request.user!.id
    const { platform_id, game_id, days } = request.query as { platform_id?: string; game_id?: string; days: number }

    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    let whereConditions = [
      eq(sessions.userId, userId),
      gte(sessions.startedAt, startDate)
    ]

    if (platform_id) whereConditions.push(eq(sessions.platformId, platform_id))
    if (game_id) whereConditions.push(eq(sessions.gameId, game_id))

    const rtpData = await db
      .select({
        date: sql<string>`DATE(${sessions.startedAt})`,
        sessions: count(sessions.id),
        total_wagered: sql<number>`SUM(${sessions.totalWagered})`,
        total_won: sql<number>`SUM(${sessions.totalWon})`,
        rtp: sql<number>`CASE WHEN SUM(${sessions.totalWagered}) > 0 THEN (SUM(${sessions.totalWon}) / SUM(${sessions.totalWagered})) * 100 ELSE 0 END`,
        win_rate: sql<number>`(COUNT(CASE WHEN ${sessions.netResult} > 0 THEN 1 END) * 100.0) / COUNT(*)`,
        avg_session_duration: sql<number>`AVG(EXTRACT(EPOCH FROM (${sessions.endedAt} - ${sessions.startedAt}))) / 60`
      })
      .from(sessions)
      .where(and(...whereConditions))
      .groupBy(sql`DATE(${sessions.startedAt})`)
      .orderBy(sql`DATE(${sessions.startedAt})`)

    // Calculate confidence intervals (simplified)
    const overallStats = await db
      .select({
        total_sessions: count(sessions.id),
        overall_rtp: sql<number>`CASE WHEN SUM(${sessions.totalWagered}) > 0 THEN (SUM(${sessions.totalWon}) / SUM(${sessions.totalWagered})) * 100 ELSE 0 END`,
        std_dev: sql<number>`STDDEV(${sessions.rtp})`
      })
      .from(sessions)
      .where(and(...whereConditions))

    return {
      success: true,
      data: {
        daily_rtp: rtpData,
        overall_stats: overallStats[0],
        confidence_interval: calculateConfidenceInterval(overallStats[0])
      }
    }
  })

  // Bonus analysis - NEW FEATURE OPPORTUNITY
  fastify.get('/bonus', async (request, reply) => {
    const userId = request.user!.id

    const bonusStats = await db
      .select({
        platform_name: platforms.displayName,
        bonus_triggers: sql<number>`COUNT(CASE WHEN ${transactions.bonusTriggered} = true THEN 1 END)`,
        total_spins: count(transactions.id),
        bonus_frequency: sql<number>`(COUNT(CASE WHEN ${transactions.bonusTriggered} = true THEN 1 END) * 100.0) / COUNT(*)`,
        avg_bonus_payout: sql<number>`AVG(CASE WHEN ${transactions.bonusTriggered} = true THEN ${transactions.winAmount} END)`,
        best_bonus_payout: sql<number>`MAX(CASE WHEN ${transactions.bonusTriggered} = true THEN ${transactions.winAmount} END)`
      })
      .from(transactions)
      .innerJoin(sessions, eq(transactions.sessionId, sessions.id))
      .innerJoin(platforms, eq(sessions.platformId, platforms.id))
      .where(eq(sessions.userId, userId))
      .groupBy(platforms.id, platforms.displayName)
      .orderBy(desc(sql`COUNT(CASE WHEN ${transactions.bonusTriggered} = true THEN 1 END)`))

    return { success: true, data: bonusStats }
  })

  // Jackpot tracking - NEW FEATURE OPPORTUNITY
  fastify.get('/jackpots', async (request, reply) => {
    const userId = request.user!.id

    const jackpotHits = await db
      .select({
        platform_name: platforms.displayName,
        game_id: transactions.gameId,
        hit_time: transactions.timestamp,
        payout: transactions.winAmount,
        bet_amount: transactions.betAmount,
        multiplier: sql<number>`${transactions.winAmount} / ${transactions.betAmount}`
      })
      .from(transactions)
      .innerJoin(sessions, eq(transactions.sessionId, sessions.id))
      .innerJoin(platforms, eq(sessions.platformId, platforms.id))
      .where(and(
        eq(sessions.userId, userId),
        eq(transactions.jackpotHit, true)
      ))
      .orderBy(desc(transactions.timestamp))
      .limit(50)

    return { success: true, data: jackpotHits }
  })
}

function calculateConfidenceInterval(stats: any) {
  if (!stats || stats.total_sessions < 30) {
    return { lower: null, upper: null, note: 'Insufficient data for confidence interval' }
  }

  const margin = 1.96 * (stats.std_dev / Math.sqrt(stats.total_sessions))
  return {
    lower: Math.max(0, stats.overall_rtp - margin),
    upper: Math.min(100, stats.overall_rtp + margin),
    confidence: 95
  }
}
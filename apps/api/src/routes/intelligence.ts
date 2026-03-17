import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { db } from '../db/client.js'
import { transactions, sessions, platforms } from '../db/schema/comprehensive.js'
import { eq, and, gte, desc, sql, count } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth.js'

export const gameIntelligenceRoutes: FastifyPluginAsync = async (fastify) => {
  // Require auth for all intelligence routes (user can view community data)
  fastify.addHook('preValidation', requireAuth)

  // Game RTP analysis - community aggregated data
  fastify.get('/games/rtp', {
    schema: {
      querystring: z.object({
        platform_id: z.string().uuid().optional(),
        min_spins: z.coerce.number().min(100).default(1000)
      })
    }
  }, async (request, reply) => {
    const { platform_id, min_spins } = request.query as { platform_id?: string; min_spins: number }

    let whereConditions = [
      sql`COUNT(${transactions.id}) >= ${min_spins}`
    ]

    if (platform_id) {
      whereConditions.push(eq(sessions.platformId, platform_id))
    }

    const gameRtpData = await db
      .select({
        game_id: transactions.gameId,
        platform_name: platforms.displayName,
        total_spins: count(transactions.id),
        total_wagered: sql<number>`SUM(${transactions.betAmount})`,
        total_won: sql<number>`SUM(${transactions.winAmount})`,
        community_rtp: sql<number>`(SUM(${transactions.winAmount}) / SUM(${transactions.betAmount})) * 100`,
        unique_players: sql<number>`COUNT(DISTINCT ${sessions.userId})`,
        bonus_frequency: sql<number>`(COUNT(CASE WHEN ${transactions.bonusTriggered} = true THEN 1 END) * 100.0) / COUNT(*)`,
        avg_bonus_payout: sql<number>`AVG(CASE WHEN ${transactions.bonusTriggered} = true THEN ${transactions.winAmount} END)`,
        max_win: sql<number>`MAX(${transactions.winAmount})`,
        volatility_score: sql<number>`STDDEV(${transactions.winAmount}) / AVG(${transactions.winAmount})`
      })
      .from(transactions)
      .innerJoin(sessions, eq(transactions.sessionId, sessions.id))
      .innerJoin(platforms, eq(sessions.platformId, platforms.id))
      .where(and(...whereConditions.slice(1))) // Skip the HAVING clause here
      .groupBy(transactions.gameId, platforms.id, platforms.displayName)
      .having(sql`COUNT(${transactions.id}) >= ${min_spins}`)
      .orderBy(desc(sql`COUNT(${transactions.id})`))

    return { success: true, data: gameRtpData }
  })

  // Game activity summary — historical play frequency per game (last 7 days)
  // NOTE: Returns neutral historical stats only. No HOT/COLD classification,
  // no outcome prediction, no betting recommendations.
  fastify.get('/games/activity', async (request, reply) => {
    const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const gameActivity = await db
      .select({
        game_id: transactions.gameId,
        platform_name: platforms.displayName,
        spins_last_24h: sql<number>`COUNT(CASE WHEN ${sessions.startedAt} >= ${last24Hours} THEN 1 END)`,
        spins_last_7d: sql<number>`COUNT(CASE WHEN ${sessions.startedAt} >= ${last7Days} THEN 1 END)`,
        avg_win_last_7d: sql<number>`AVG(CASE WHEN ${sessions.startedAt} >= ${last7Days} THEN ${transactions.winAmount} END)`,
        unique_players_last_7d: sql<number>`COUNT(DISTINCT CASE WHEN ${sessions.startedAt} >= ${last7Days} THEN ${sessions.userId} END)`
      })
      .from(transactions)
      .innerJoin(sessions, eq(transactions.sessionId, sessions.id))
      .innerJoin(platforms, eq(sessions.platformId, platforms.id))
      .where(gte(sessions.startedAt, last7Days))
      .groupBy(transactions.gameId, platforms.id, platforms.displayName)
      .having(sql`COUNT(CASE WHEN ${sessions.startedAt} >= ${last24Hours} THEN 1 END) >= 50`)
      .orderBy(desc(sql`COUNT(CASE WHEN ${sessions.startedAt} >= ${last24Hours} THEN 1 END)`))

    return { success: true, data: gameActivity }
  })

  // Bet size distribution — historical breakdown of play volume by bet range.
  // Shows how often each bet range was used and observed outcomes.
  // This is descriptive data only — not a recommendation to bet any particular amount.
  fastify.get('/betting/distribution', {
    schema: {
      querystring: z.object({
        game_id: z.string().optional(),
        platform_id: z.string().uuid().optional()
      })
    }
  }, async (request, reply) => {
    const { game_id, platform_id } = request.query as { game_id?: string; platform_id?: string }

    const whereConditions = []
    if (game_id) whereConditions.push(eq(transactions.gameId, game_id))
    if (platform_id) whereConditions.push(eq(sessions.platformId, platform_id))

    const betDistribution = await db
      .select({
        bet_range: sql<string>`
          CASE
            WHEN ${transactions.betAmount} <= 1 THEN '0.01-1.00'
            WHEN ${transactions.betAmount} <= 5 THEN '1.01-5.00'
            WHEN ${transactions.betAmount} <= 10 THEN '5.01-10.00'
            WHEN ${transactions.betAmount} <= 25 THEN '10.01-25.00'
            ELSE '25.00+'
          END`,
        total_spins: count(transactions.id),
        avg_rtp: sql<number>`(SUM(${transactions.winAmount}) / SUM(${transactions.betAmount})) * 100`,
        avg_win: sql<number>`AVG(CASE WHEN ${transactions.winAmount} > ${transactions.betAmount} THEN ${transactions.winAmount} END)`,
        max_win: sql<number>`MAX(${transactions.winAmount})`,
        bonus_frequency: sql<number>`(COUNT(CASE WHEN ${transactions.bonusTriggered} = true THEN 1 END) * 100.0) / COUNT(*)`
      })
      .from(transactions)
      .innerJoin(sessions, eq(transactions.sessionId, sessions.id))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .groupBy(sql`
        CASE
          WHEN ${transactions.betAmount} <= 1 THEN '0.01-1.00'
          WHEN ${transactions.betAmount} <= 5 THEN '1.01-5.00'
          WHEN ${transactions.betAmount} <= 10 THEN '5.01-10.00'
          WHEN ${transactions.betAmount} <= 25 THEN '10.01-25.00'
          ELSE '25.00+'
        END`)
      .orderBy(sql`AVG(${transactions.betAmount})`)

    return { success: true, data: betDistribution }
  })

  // Session timing history — historical distribution of when the user played.
  // Shows personal play patterns by hour/day for self-awareness only.
  // No "best time to play" framing — just descriptive personal history.
  fastify.get('/timing/history', async (request, reply) => {
    const userId = request.user?.id

    const timingHistory = await db
      .select({
        hour: sql<number>`EXTRACT(HOUR FROM ${sessions.startedAt})`,
        day_of_week: sql<number>`EXTRACT(DOW FROM ${sessions.startedAt})`,
        avg_rtp: sql<number>`AVG(${sessions.rtp})`,
        avg_session_duration_minutes: sql<number>`AVG(EXTRACT(EPOCH FROM (${sessions.endedAt} - ${sessions.startedAt}))) / 60`,
        session_count: count(sessions.id)
      })
      .from(sessions)
      .where(userId ? eq(sessions.userId, userId) : undefined)
      .groupBy(
        sql`EXTRACT(HOUR FROM ${sessions.startedAt})`,
        sql`EXTRACT(DOW FROM ${sessions.startedAt})`
      )
      .having(sql`COUNT(${sessions.id}) >= 10`)
      .orderBy(sql`EXTRACT(DOW FROM ${sessions.startedAt})`, sql`EXTRACT(HOUR FROM ${sessions.startedAt})`)

    return { success: true, data: timingHistory }
  })

  // Platform comparison intelligence
  fastify.get('/platforms/comparison', async (request, reply) => {
    const platformComparison = await db
      .select({
        platform_name: platforms.displayName,
        avg_rtp: sql<number>`AVG(${sessions.rtp})`,
        total_sessions: count(sessions.id),
        avg_session_profit: sql<number>`AVG(${sessions.netResult})`,
        win_rate: sql<number>`(COUNT(CASE WHEN ${sessions.netResult} > 0 THEN 1 END) * 100.0) / COUNT(*)`,
        avg_session_duration: sql<number>`AVG(EXTRACT(EPOCH FROM (${sessions.endedAt} - ${sessions.startedAt}))) / 60`,
        bonus_frequency: sql<number>`
          (SELECT COUNT(*) FROM ${transactions} t 
           JOIN ${sessions} s ON t.session_id = s.id 
           WHERE s.platform_id = ${platforms.id} AND t.bonus_triggered = true) * 100.0 / 
          NULLIF((SELECT COUNT(*) FROM ${transactions} t 
                  JOIN ${sessions} s ON t.session_id = s.id 
                  WHERE s.platform_id = ${platforms.id}), 0)`,
        reliability_score: sql<number>`
          CASE 
            WHEN COUNT(${sessions.id}) >= 100 THEN 95
            WHEN COUNT(${sessions.id}) >= 50 THEN 85
            WHEN COUNT(${sessions.id}) >= 20 THEN 75
            ELSE 60
          END`
      })
      .from(platforms)
      .leftJoin(sessions, eq(platforms.id, sessions.platformId))
      .groupBy(platforms.id, platforms.displayName)
      .having(sql`COUNT(${sessions.id}) >= 10`)
      .orderBy(desc(sql`AVG(${sessions.rtp})`))

    return { success: true, data: platformComparison }
  })
}
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
  fastify.get('/intelligence/games/rtp', {
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

  // Hot/Cold game analysis - NEW FEATURE
  fastify.get('/intelligence/games/temperature', async (request, reply) => {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const gameTemperature = await db
      .select({
        game_id: transactions.gameId,
        platform_name: platforms.displayName,
        recent_rtp: sql<number>`
          CASE WHEN SUM(CASE WHEN ${sessions.startedAt} >= ${last24Hours} THEN ${transactions.betAmount} END) > 0 
          THEN (SUM(CASE WHEN ${sessions.startedAt} >= ${last24Hours} THEN ${transactions.winAmount} END) / 
                SUM(CASE WHEN ${sessions.startedAt} >= ${last24Hours} THEN ${transactions.betAmount} END)) * 100
          ELSE NULL END`,
        historical_rtp: sql<number>`
          CASE WHEN SUM(CASE WHEN ${sessions.startedAt} >= ${last7Days} THEN ${transactions.betAmount} END) > 0 
          THEN (SUM(CASE WHEN ${sessions.startedAt} >= ${last7Days} THEN ${transactions.winAmount} END) / 
                SUM(CASE WHEN ${sessions.startedAt} >= ${last7Days} THEN ${transactions.betAmount} END)) * 100
          ELSE NULL END`,
        recent_spins: sql<number>`COUNT(CASE WHEN ${sessions.startedAt} >= ${last24Hours} THEN 1 END)`,
        temperature: sql<string>`
          CASE 
            WHEN SUM(CASE WHEN ${sessions.startedAt} >= ${last24Hours} THEN ${transactions.betAmount} END) > 0 
            AND (SUM(CASE WHEN ${sessions.startedAt} >= ${last24Hours} THEN ${transactions.winAmount} END) / 
                 SUM(CASE WHEN ${sessions.startedAt} >= ${last24Hours} THEN ${transactions.betAmount} END)) > 1.05
            THEN 'HOT'
            WHEN SUM(CASE WHEN ${sessions.startedAt} >= ${last24Hours} THEN ${transactions.betAmount} END) > 0 
            AND (SUM(CASE WHEN ${sessions.startedAt} >= ${last24Hours} THEN ${transactions.winAmount} END) / 
                 SUM(CASE WHEN ${sessions.startedAt} >= ${last24Hours} THEN ${transactions.betAmount} END)) < 0.85
            THEN 'COLD'
            ELSE 'NEUTRAL'
          END`
      })
      .from(transactions)
      .innerJoin(sessions, eq(transactions.sessionId, sessions.id))
      .innerJoin(platforms, eq(sessions.platformId, platforms.id))
      .where(gte(sessions.startedAt, last7Days))
      .groupBy(transactions.gameId, platforms.id, platforms.displayName)
      .having(sql`COUNT(CASE WHEN ${sessions.startedAt} >= ${last24Hours} THEN 1 END) >= 50`)
      .orderBy(desc(sql`COUNT(CASE WHEN ${sessions.startedAt} >= ${last24Hours} THEN 1 END)`))

    return { success: true, data: gameTemperature }
  })

  // Optimal bet sizing analysis - NEW FEATURE
  fastify.get('/intelligence/betting/optimal-size', {
    schema: {
      querystring: z.object({
        game_id: z.string().optional(),
        platform_id: z.string().uuid().optional()
      })
    }
  }, async (request, reply) => {
    const { game_id, platform_id } = request.query as { game_id?: string; platform_id?: string }

    let whereConditions = []
    if (game_id) whereConditions.push(eq(transactions.gameId, game_id))
    if (platform_id) whereConditions.push(eq(sessions.platformId, platform_id))

    const betSizeAnalysis = await db
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
        win_rate: sql<number>`(COUNT(CASE WHEN ${transactions.winAmount} > ${transactions.betAmount} THEN 1 END) * 100.0) / COUNT(*)`,
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

    return { success: true, data: betSizeAnalysis }
  })

  // Session timing analysis - when to play
  fastify.get('/intelligence/timing/optimal-hours', async (request, reply) => {
    const userId = request.user?.id

    const timingAnalysis = await db
      .select({
        hour: sql<number>`EXTRACT(HOUR FROM ${sessions.startedAt})`,
        day_of_week: sql<number>`EXTRACT(DOW FROM ${sessions.startedAt})`,
        avg_rtp: sql<number>`AVG(${sessions.rtp})`,
        avg_session_profit: sql<number>`AVG(${sessions.netResult})`,
        session_count: count(sessions.id),
        win_rate: sql<number>`(COUNT(CASE WHEN ${sessions.netResult} > 0 THEN 1 END) * 100.0) / COUNT(*)`,
        avg_duration_minutes: sql<number>`AVG(EXTRACT(EPOCH FROM (${sessions.endedAt} - ${sessions.startedAt}))) / 60`
      })
      .from(sessions)
      .where(userId ? eq(sessions.userId, userId) : undefined)
      .groupBy(
        sql`EXTRACT(HOUR FROM ${sessions.startedAt})`,
        sql`EXTRACT(DOW FROM ${sessions.startedAt})`
      )
      .having(sql`COUNT(${sessions.id}) >= 10`)
      .orderBy(desc(sql`AVG(${sessions.rtp})`))

    return { success: true, data: timingAnalysis }
  })

  // Bonus prediction model - NEW FEATURE
  fastify.get('/intelligence/bonus/prediction', {
    schema: {
      querystring: z.object({
        game_id: z.string(),
        spins_since_bonus: z.coerce.number().min(0)
      })
    }
  }, async (request, reply) => {
    const { game_id, spins_since_bonus } = request.query as { game_id: string; spins_since_bonus: number }

    // Analyze historical bonus patterns
    const bonusPatterns = await db
      .select({
        avg_spins_between_bonus: sql<number>`AVG(spins_between)`,
        median_spins_between_bonus: sql<number>`PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY spins_between)`,
        bonus_probability_next_10: sql<number>`
          COUNT(CASE WHEN spins_between <= ${spins_since_bonus + 10} THEN 1 END) * 100.0 / COUNT(*)`,
        bonus_probability_next_50: sql<number>`
          COUNT(CASE WHEN spins_between <= ${spins_since_bonus + 50} THEN 1 END) * 100.0 / COUNT(*)`,
        total_bonus_samples: count()
      })
      .from(sql`(
        SELECT 
          ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY timestamp) - 
          ROW_NUMBER() OVER (PARTITION BY session_id, bonus_triggered ORDER BY timestamp) as spins_between
        FROM ${transactions}
        WHERE game_id = ${game_id} AND bonus_triggered = true
      ) as bonus_gaps`)

    const totalBonusSamples = bonusPatterns[0]?.total_bonus_samples ?? 0
    const prediction = {
      current_drought: spins_since_bonus,
      probability_next_10_spins: bonusPatterns[0]?.bonus_probability_next_10 || 0,
      probability_next_50_spins: bonusPatterns[0]?.bonus_probability_next_50 || 0,
      average_gap: bonusPatterns[0]?.avg_spins_between_bonus || 0,
      confidence: totalBonusSamples > 100 ? 'HIGH' :
                  totalBonusSamples > 50 ? 'MEDIUM' : 'LOW'
    }

    return { success: true, data: prediction }
  })

  // Platform comparison intelligence
  fastify.get('/intelligence/platforms/comparison', async (request, reply) => {
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
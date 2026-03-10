import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { query as dbQuery, unsafeQuery } from '../db/client.js'
import { sql } from 'drizzle-orm'
import { PaginationSchema } from '../lib/common-schemas.js'
// import type { WSMessage } from '@sweepbot/types' // TODO: re-enable with @fastify/websocket

const JackpotQuerySchema = z.object({
  platformId: z.string().uuid().optional(),
  gameId: z.string().uuid().optional(),
  minAmount: z.coerce.number().min(0).optional(),
  sortBy: z.enum(['current_amount', 'growth_rate', 'last_hit']).default('current_amount'),
  ...PaginationSchema.shape,
})

// const SubscribeBody = z.object({
//   gameIds: z.array(z.string().uuid()).min(1).max(50),
// }) // TODO: re-enable with @fastify/websocket

export async function jackpotRoutes(app: FastifyInstance): Promise<void> {
  // ─── GET /jackpots ─────────────────────────────────────────────────────────
  // Current jackpot leaderboard — the data moat in action
  app.get(
    '/jackpots',
    {
      schema: {
        tags: ['Jackpots'],
        summary: 'Live jackpot leaderboard across all platforms',
        querystring: {
          type: 'object',
          properties: {
            platformId: { type: 'string', format: 'uuid' },
            gameId: { type: 'string', format: 'uuid' },
            minAmount: { type: 'number' },
            sortBy: { type: 'string', enum: ['current_amount', 'growth_rate', 'last_hit'] },
            page: { type: 'number' },
            pageSize: { type: 'number' },
          },
        },
      },
    },
    async (request, reply) => {
      const query = JackpotQuerySchema.parse(request.query)
      const offset = (query.page - 1) * query.pageSize

      const platformFilter = query.platformId
        ? sql`AND js.platform_id = ${query.platformId}`
        : sql``

      const gameFilter = query.gameId ? sql`AND js.game_id = ${query.gameId}` : sql``

      const minFilter = query.minAmount ? sql`AND js.amount >= ${query.minAmount}` : sql``

      const orderClause =
        query.sortBy === 'growth_rate'
          ? sql`ORDER BY growth_rate_per_hour DESC NULLS LAST`
          : query.sortBy === 'last_hit'
            ? sql`ORDER BY js.last_hit_at DESC NULLS LAST`
            : sql`ORDER BY js.amount DESC`

      const rows = await dbQuery(sql`
        WITH latest_snapshots AS (
          SELECT DISTINCT ON (platform_id, game_id, jackpot_name)
            id,
            platform_id,
            game_id,
            jackpot_name,
            amount,
            currency,
            last_hit_at,
            last_hit_amount,
            captured_at,
            -- Growth rate: SC gained per hour since last hit
            CASE
              WHEN last_hit_at IS NOT NULL AND amount > last_hit_amount
              THEN ROUND(
                (amount - COALESCE(last_hit_amount, 0))
                / GREATEST(EXTRACT(EPOCH FROM (NOW() - last_hit_at)) / 3600, 0.01),
                2
              )
              ELSE NULL
            END AS growth_rate_per_hour,
            -- Historical hit count
            (
              SELECT COUNT(*) FROM jackpot_snapshots js2
              WHERE js2.platform_id = js.platform_id
                AND js2.game_id = js.game_id
                AND js2.jackpot_name = js.jackpot_name
                AND js2.last_hit_at > NOW() - INTERVAL '30 days'
            ) AS hits_last_30_days,
            -- Average jackpot size at hit (from our historical data)
            (
              SELECT ROUND(AVG(last_hit_amount), 2) FROM jackpot_snapshots js3
              WHERE js3.platform_id = js.platform_id
                AND js3.game_id = js.game_id
                AND js3.jackpot_name = js.jackpot_name
                AND js3.last_hit_amount IS NOT NULL
                AND js3.last_hit_at > NOW() - INTERVAL '90 days'
            ) AS avg_hit_amount_90d
          FROM jackpot_snapshots js
          WHERE captured_at > NOW() - INTERVAL '5 minutes'
          ORDER BY platform_id, game_id, jackpot_name, captured_at DESC
        )
        SELECT
          ls.*,
          p.name AS platform_name,
          p.slug AS platform_slug,
          p.logo_url AS platform_logo_url,
          g.name AS game_name,
          g.thumbnail_url AS game_thumbnail
        FROM latest_snapshots ls
        INNER JOIN platforms p ON p.id = ls.platform_id
        LEFT JOIN games g ON g.id = ls.game_id
        WHERE 1=1 ${platformFilter} ${gameFilter} ${minFilter}
        ${orderClause}
        LIMIT ${query.pageSize} OFFSET ${offset}
      `)

      return reply.send({ success: true, data: rows.rows })
    }
  )

  // ─── GET /jackpots/:gameId/history ────────────────────────────────────────
  // Historical jackpot data — pure data moat material
  app.get(
    '/jackpots/:gameId/history',
    {
      schema: {
        tags: ['Jackpots'],
        summary: 'Historical jackpot snapshots for a game (30-day chart)',
        params: {
          type: 'object',
          properties: { gameId: { type: 'string', format: 'uuid' } },
          required: ['gameId'],
        },
      },
    },
    async (request, reply) => {
      const { gameId } = request.params as { gameId: string }

      // Downsample to hourly for chart performance
      const history = await dbQuery(sql`
        SELECT
          DATE_TRUNC('hour', captured_at) AS hour,
          jackpot_name,
          MAX(amount) AS peak_amount,
          MIN(amount) AS min_amount,
          AVG(amount)::numeric(15,2) AS avg_amount,
          MAX(last_hit_at) AS latest_hit_at
        FROM jackpot_snapshots
        WHERE game_id = ${gameId}
          AND captured_at > NOW() - INTERVAL '30 days'
        GROUP BY DATE_TRUNC('hour', captured_at), jackpot_name
        ORDER BY hour ASC, jackpot_name ASC
      `)

      // Also get all recorded hit events (where amount dropped significantly)
      const hitEvents = await dbQuery(sql`
        SELECT DISTINCT
          jackpot_name,
          last_hit_at,
          last_hit_amount
        FROM jackpot_snapshots
        WHERE game_id = ${gameId}
          AND last_hit_at IS NOT NULL
          AND last_hit_at > NOW() - INTERVAL '30 days'
        ORDER BY last_hit_at DESC
        LIMIT 100
      `)

      return reply.send({
        success: true,
        data: {
          history: history.rows,
          hitEvents: hitEvents.rows,
        },
      })
    }
  )

  // ─── WebSocket /jackpots/live ──────────────────────────────────────────────
  // TODO: Re-enable when @fastify/websocket is added for Fastify 5
  // Real-time jackpot push updates are disabled until websocket plugin is available

  // ─── GET /jackpots/stats ──────────────────────────────────────────────────
  // Aggregate statistics — marketing-friendly numbers
  app.get(
    '/jackpots/stats',
    {
      schema: {
        tags: ['Jackpots'],
        summary: 'Aggregate jackpot statistics across all tracked platforms',
      },
    },
    async (_request, reply) => {
      const stats = await dbQuery(sql`
        SELECT
          COUNT(DISTINCT (platform_id, game_id, jackpot_name)) AS total_jackpots_tracked,
          COUNT(DISTINCT platform_id) AS platforms_tracked,
          SUM(amount) AS total_jackpot_value,
          MAX(amount) AS largest_current_jackpot,
          COUNT(*) FILTER (WHERE last_hit_at > NOW() - INTERVAL '24 hours') AS hits_last_24h,
          (
            SELECT SUM(last_hit_amount) FROM jackpot_snapshots
            WHERE last_hit_at > NOW() - INTERVAL '30 days'
              AND last_hit_amount IS NOT NULL
          ) AS total_paid_out_30d,
          MIN(captured_at) AS tracking_started_at
        FROM (
          SELECT DISTINCT ON (platform_id, game_id, jackpot_name)
            platform_id, game_id, jackpot_name, amount, last_hit_at, last_hit_amount, captured_at
          FROM jackpot_snapshots
          ORDER BY platform_id, game_id, jackpot_name, captured_at DESC
        ) latest
      `)

      return reply.send({ success: true, data: stats.rows[0] ?? null })
    }
  )
}

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '../db/client.js'
import { requireAuth } from '../middleware/auth.js'
import { sql } from 'drizzle-orm'

const PlatformParamsSchema = z.object({
  id: z.string().uuid(),
})

const PlatformQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['active', 'inactive', 'watchlist']).optional(),
  sortBy: z.enum(['name', 'trust_score', 'created_at']).default('name'),
  sortDir: z.enum(['asc', 'desc']).default('asc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

const GamesQuerySchema = z.object({
  providerId: z.string().uuid().optional(),
  volatility: z.enum(['low', 'medium', 'high', 'very_high']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export async function platformRoutes(app: FastifyInstance): Promise<void> {
  // ─── GET /platforms ───────────────────────────────────────────────────────
  app.get(
    '/platforms',
    {
      schema: {
        tags: ['Platforms'],
        summary: 'List all sweepstakes platforms with Trust Index scores',
        querystring: {
          type: 'object',
          properties: {
            search: { type: 'string' },
            status: { type: 'string', enum: ['active', 'inactive', 'watchlist'] },
            sortBy: { type: 'string', enum: ['name', 'trust_score', 'created_at'] },
            sortDir: { type: 'string', enum: ['asc', 'desc'] },
            page: { type: 'number' },
            pageSize: { type: 'number' },
          },
        },
      },
    },
    async (request, reply) => {
      const query = PlatformQuerySchema.parse(request.query)
      const offset = (query.page - 1) * query.pageSize

      const searchClause = query.search
        ? sql`AND (p.name ILIKE ${'%' + query.search + '%'} OR p.slug ILIKE ${'%' + query.search + '%'})`
        : sql``

      const statusClause = query.status ? sql`AND p.status = ${query.status}` : sql``

      const orderClause =
        query.sortBy === 'trust_score'
          ? sql`ORDER BY ti.overall_score ${query.sortDir === 'asc' ? sql`ASC` : sql`DESC`} NULLS LAST`
          : query.sortBy === 'created_at'
            ? sql`ORDER BY p.created_at ${query.sortDir === 'asc' ? sql`ASC` : sql`DESC`}`
            : sql`ORDER BY p.name ${query.sortDir === 'asc' ? sql`ASC` : sql`DESC`}`

      const [rows, countResult] = await Promise.all([
        db.execute(sql`
          SELECT
            p.id,
            p.name,
            p.slug,
            p.url,
            p.logo_url,
            p.status,
            p.founded_year,
            p.sweepcoins_name,
            p.gold_coins_name,
            p.min_redemption_sc,
            p.max_redemption_sc,
            p.affiliate_url,
            p.created_at,
            ti.overall_score AS trust_score,
            ti.redemption_speed_score,
            ti.bonus_generosity_score,
            ti.tos_stability_score,
            ti.updated_at AS trust_updated_at
          FROM platforms p
          LEFT JOIN trust_index_scores ti ON ti.platform_id = p.id
            AND ti.calculated_at = (
              SELECT MAX(t2.calculated_at)
              FROM trust_index_scores t2
              WHERE t2.platform_id = p.id
            )
          WHERE 1=1 ${searchClause} ${statusClause}
          ${orderClause}
          LIMIT ${query.pageSize} OFFSET ${offset}
        `),
        db.execute(sql`
          SELECT COUNT(*) AS total
          FROM platforms p
          WHERE 1=1 ${searchClause} ${statusClause}
        `),
      ])

      const total = Number((countResult.rows[0] as { total: string }).total)

      return reply.send({
        success: true,
        data: rows.rows,
        meta: {
          page: query.page,
          pageSize: query.pageSize,
          total,
          hasMore: offset + rows.rows.length < total,
        },
      })
    }
  )

  // ─── GET /platforms/:id ───────────────────────────────────────────────────
  app.get(
    '/platforms/:id',
    {
      schema: {
        tags: ['Platforms'],
        summary: 'Get a single platform with full Trust Index breakdown',
        params: {
          type: 'object',
          properties: { id: { type: 'string', format: 'uuid' } },
          required: ['id'],
        },
      },
    },
    async (request, reply) => {
      const { id } = PlatformParamsSchema.parse(request.params)

      const [platform, trustHistory, recentRedemptions] = await Promise.all([
        db.execute(sql`
          SELECT
            p.*,
            ti.overall_score AS trust_score,
            ti.redemption_speed_score,
            ti.redemption_rejection_rate_score,
            ti.tos_stability_score,
            ti.bonus_generosity_score,
            ti.community_satisfaction_score,
            ti.support_responsiveness_score,
            ti.regulatory_standing_score,
            ti.sample_size AS trust_sample_size,
            ti.calculated_at AS trust_calculated_at
          FROM platforms p
          LEFT JOIN trust_index_scores ti ON ti.platform_id = p.id
            AND ti.calculated_at = (
              SELECT MAX(t2.calculated_at)
              FROM trust_index_scores t2
              WHERE t2.platform_id = p.id
            )
          WHERE p.id = ${id}
        `),
        db.execute(sql`
          SELECT overall_score, calculated_at
          FROM trust_index_scores
          WHERE platform_id = ${id}
          ORDER BY calculated_at DESC
          LIMIT 30
        `),
        db.execute(sql`
          SELECT
            payment_method,
            AVG(EXTRACT(EPOCH FROM (completed_at - submitted_at)) / 86400)::numeric(5,2) AS avg_days,
            COUNT(*) AS count
          FROM redemptions
          WHERE platform_id = ${id}
            AND status = 'completed'
            AND completed_at IS NOT NULL
            AND submitted_at >= NOW() - INTERVAL '90 days'
          GROUP BY payment_method
        `),
      ])

      if (!platform.rows.length) {
        return reply.code(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Platform not found' },
        })
      }

      return reply.send({
        success: true,
        data: {
          ...platform.rows[0],
          trustHistory: trustHistory.rows,
          redemptionStats: recentRedemptions.rows,
        },
      })
    }
  )

  // ─── GET /platforms/:id/games ─────────────────────────────────────────────
  app.get(
    '/platforms/:id/games',
    {
      schema: {
        tags: ['Platforms'],
        summary: 'List games available on a platform with aggregate RTP data',
        params: {
          type: 'object',
          properties: { id: { type: 'string', format: 'uuid' } },
          required: ['id'],
        },
      },
    },
    async (request, reply) => {
      const { id } = PlatformParamsSchema.parse(request.params)
      const query = GamesQuerySchema.parse(request.query)
      const offset = (query.page - 1) * query.pageSize

      const providerClause = query.providerId
        ? sql`AND g.provider_id = ${query.providerId}`
        : sql``
      const volatilityClause = query.volatility
        ? sql`AND g.volatility = ${query.volatility}`
        : sql``

      const rows = await db.execute(sql`
        SELECT
          g.id,
          g.name,
          g.slug,
          g.thumbnail_url,
          g.volatility,
          g.theoretical_rtp,
          g.community_rtp_aggregate,
          g.community_rtp_sample_size,
          g.bonus_trigger_frequency,
          gp.name AS provider_name,
          gp.slug AS provider_slug
        FROM games g
        INNER JOIN game_providers gp ON gp.id = g.provider_id
        WHERE g.platform_id = ${id}
          AND g.is_active = TRUE
          ${providerClause}
          ${volatilityClause}
        ORDER BY g.name ASC
        LIMIT ${query.pageSize} OFFSET ${offset}
      `)

      return reply.send({
        success: true,
        data: rows.rows,
        meta: {
          page: query.page,
          pageSize: query.pageSize,
        },
      })
    }
  )

  // ─── GET /platforms/:id/tos-history ──────────────────────────────────────
  app.get(
    '/platforms/:id/tos-history',
    {
      preValidation: [requireAuth],
      schema: {
        tags: ['Platforms'],
        summary: 'Get TOS change history for a platform',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { id } = PlatformParamsSchema.parse(request.params)

      const rows = await db.execute(sql`
        SELECT
          id,
          section,
          change_summary,
          change_severity,
          previous_hash,
          current_hash,
          captured_at
        FROM tos_snapshots
        WHERE platform_id = ${id}
          AND change_summary IS NOT NULL
        ORDER BY captured_at DESC
        LIMIT 50
      `)

      return reply.send({ success: true, data: rows.rows })
    }
  )

  // ─── POST /platforms/:id/upvote-trust ─────────────────────────────────────
  // Community sentiment signal for Trust Index
  app.post(
    '/platforms/:id/upvote-trust',
    {
      preValidation: [requireAuth],
      schema: {
        tags: ['Platforms'],
        summary: 'Submit community trust signal for a platform',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['sentiment', 'category'],
          properties: {
            sentiment: { type: 'string', enum: ['positive', 'negative', 'neutral'] },
            category: {
              type: 'string',
              enum: ['redemption', 'support', 'bonus', 'fairness', 'general'],
            },
            comment: { type: 'string', maxLength: 500 },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = PlatformParamsSchema.parse(request.params)
      const body = request.body as {
        sentiment: string
        category: string
        comment?: string
      }
      const userId = request.user!.id

      // Upsert community signal (1 vote per user per platform per day per category)
      await db.execute(sql`
        INSERT INTO platform_community_signals
          (platform_id, user_id, sentiment, category, comment, created_at)
        VALUES
          (${id}, ${userId}, ${body.sentiment}, ${body.category}, ${body.comment ?? null}, NOW())
        ON CONFLICT (platform_id, user_id, category, DATE(created_at))
        DO UPDATE SET
          sentiment = EXCLUDED.sentiment,
          comment = EXCLUDED.comment
      `)

      return reply.code(201).send({ success: true, data: { recorded: true } })
    }
  )
}

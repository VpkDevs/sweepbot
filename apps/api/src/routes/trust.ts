import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { query as dbQuery } from '../db/client.js'
import { sql } from 'drizzle-orm'
import { env } from '../utils/env.js'
import { constantTimeCompare } from '@sweepbot/utils'

const TrustQuerySchema = z.object({
  minScore: z.coerce.number().min(0).max(100).optional(),
  sortBy: z.enum(['overall_score', 'redemption_speed', 'tos_stability', 'calculated_at']).default('overall_score'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

/**
 * Trust Index scoring weights — tuned over time as data grows.
 * These sum to 1.0 and can be tweaked as the product matures.
 */
const TRUST_WEIGHTS = {
  redemption_speed: 0.20,
  redemption_rejection_rate: 0.20,
  tos_stability: 0.15,
  bonus_generosity: 0.10,
  community_satisfaction: 0.15,
  support_responsiveness: 0.10,
  regulatory_standing: 0.10,
} as const

export async function trustRoutes(app: FastifyInstance): Promise<void> {
  // ─── GET /trust-index ─────────────────────────────────────────────────────
  app.get(
    '/trust-index',
    {
      schema: {
        tags: ['Trust Index'],
        summary: 'SweepBot Trust Index — ranked list of all platforms',
        querystring: {
          type: 'object',
          properties: {
            minScore: { type: 'number', minimum: 0, maximum: 100 },
            sortBy: {
              type: 'string',
              enum: ['overall_score', 'redemption_speed', 'tos_stability', 'calculated_at'],
            },
            page: { type: 'number' },
            pageSize: { type: 'number' },
          },
        },
      },
    },
    async (request, reply) => {
      const query = TrustQuerySchema.parse(request.query)
      const offset = (query.page - 1) * query.pageSize

      const minFilter = query.minScore !== undefined
        ? sql`AND ti.overall_score >= ${query.minScore}`
        : sql``

      const orderMap: Record<string, ReturnType<typeof sql>> = {
        overall_score: sql`ti.overall_score DESC`,
        redemption_speed: sql`ti.redemption_speed_score DESC`,
        tos_stability: sql`ti.tos_stability_score DESC`,
        calculated_at: sql`ti.calculated_at DESC`,
      }
      const orderClause = orderMap[query.sortBy] ?? orderMap['overall_score']!

      const [rows, countResult] = await Promise.all([
        dbQuery(sql`
          SELECT
            p.id AS platform_id,
            p.name AS platform_name,
            p.slug AS platform_slug,
            p.logo_url,
            p.url AS platform_url,
            p.status AS platform_status,
            ti.overall_score,
            ti.redemption_speed_score,
            ti.redemption_rejection_rate_score,
            ti.tos_stability_score,
            ti.bonus_generosity_score,
            ti.community_satisfaction_score,
            ti.support_responsiveness_score,
            ti.regulatory_standing_score,
            ti.sample_size,
            ti.calculated_at,
            -- Rank among active platforms
            RANK() OVER (ORDER BY ti.overall_score DESC) AS rank,
            -- Score tier label
            CASE
              WHEN ti.overall_score >= 85 THEN 'excellent'
              WHEN ti.overall_score >= 70 THEN 'good'
              WHEN ti.overall_score >= 55 THEN 'fair'
              WHEN ti.overall_score >= 40 THEN 'poor'
              ELSE 'critical'
            END AS score_tier,
            -- 30-day trend
            (
              SELECT ti2.overall_score FROM trust_index_scores ti2
              WHERE ti2.platform_id = p.id
                AND ti2.calculated_at < NOW() - INTERVAL '30 days'
              ORDER BY ti2.calculated_at DESC
              LIMIT 1
            ) AS score_30d_ago,
            ti.overall_score - COALESCE(
              (
                SELECT ti2.overall_score FROM trust_index_scores ti2
                WHERE ti2.platform_id = p.id
                  AND ti2.calculated_at < NOW() - INTERVAL '30 days'
                ORDER BY ti2.calculated_at DESC
                LIMIT 1
              ),
              ti.overall_score
            ) AS score_change_30d
          FROM platforms p
          INNER JOIN trust_index_scores ti ON ti.platform_id = p.id
            AND ti.calculated_at = (
              SELECT MAX(t2.calculated_at) FROM trust_index_scores t2
              WHERE t2.platform_id = p.id
            )
          WHERE p.status = 'active'
            ${minFilter}
          ORDER BY ${orderClause}
          LIMIT ${query.pageSize} OFFSET ${offset}
        `),
        dbQuery(sql`
          SELECT COUNT(*) AS total
          FROM platforms p
          INNER JOIN trust_index_scores ti ON ti.platform_id = p.id
          WHERE p.status = 'active'
            ${minFilter}
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
          weights: TRUST_WEIGHTS,
        },
      })
    }
  )

  // ─── GET /trust-index/:platformId ─────────────────────────────────────────
  app.get(
    '/trust-index/:platformId',
    {
      schema: {
        tags: ['Trust Index'],
        summary: 'Detailed Trust Index report for a single platform',
        params: {
          type: 'object',
          properties: { platformId: { type: 'string', format: 'uuid' } },
          required: ['platformId'],
        },
      },
    },
    async (request, reply) => {
      const { platformId } = request.params as { platformId: string }

      const [current, history, breakdown] = await Promise.all([
        // Current score with full component breakdown
        dbQuery(sql`
          SELECT
            p.id AS platform_id,
            p.name AS platform_name,
            p.logo_url,
            p.status,
            ti.*,
            RANK() OVER (ORDER BY ti.overall_score DESC) AS rank,
            (SELECT COUNT(*) FROM platforms WHERE status = 'active') AS total_platforms
          FROM platforms p
          INNER JOIN trust_index_scores ti ON ti.platform_id = p.id
            AND ti.calculated_at = (
              SELECT MAX(t2.calculated_at) FROM trust_index_scores t2
              WHERE t2.platform_id = p.id
            )
          WHERE p.id = ${platformId}
        `),

        // 90-day history
        dbQuery(sql`
          SELECT
            overall_score,
            redemption_speed_score,
            tos_stability_score,
            community_satisfaction_score,
            calculated_at
          FROM trust_index_scores
          WHERE platform_id = ${platformId}
            AND calculated_at > NOW() - INTERVAL '90 days'
          ORDER BY calculated_at ASC
        `),

        // What's driving the score — data sources breakdown
        dbQuery(sql`
          SELECT
            'redemption_timing' AS factor,
            COUNT(*) AS data_points,
            ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - submitted_at)) / 86400), 2) AS avg_value,
            MAX(submitted_at) AS latest_data
          FROM redemptions
          WHERE platform_id = ${platformId}
            AND status = 'completed'
            AND submitted_at > NOW() - INTERVAL '90 days'
          UNION ALL
          SELECT
            'tos_changes' AS factor,
            COUNT(*) AS data_points,
            COUNT(*) FILTER (WHERE change_severity = 'major')::numeric AS avg_value,
            MAX(captured_at) AS latest_data
          FROM tos_snapshots
          WHERE platform_id = ${platformId}
            AND captured_at > NOW() - INTERVAL '90 days'
          UNION ALL
          SELECT
            'community_signals' AS factor,
            COUNT(*) AS data_points,
            ROUND(
              COUNT(*) FILTER (WHERE sentiment = 'positive')::numeric
              / NULLIF(COUNT(*), 0) * 100, 2
            ) AS avg_value,
            MAX(created_at) AS latest_data
          FROM platform_community_signals
          WHERE platform_id = ${platformId}
            AND created_at > NOW() - INTERVAL '90 days'
        `),
      ])

      if (!current.rows.length) {
        return reply.code(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Platform Trust Index data not found' },
        })
      }

      return reply.send({
        success: true,
        data: {
          current: current.rows[0],
          history: history.rows,
          dataBreakdown: breakdown.rows,
          weights: TRUST_WEIGHTS,
          methodology: {
            description:
              'The SweepBot Trust Index is a composite score (0-100) calculated from 7 independently weighted factors. Scores are recalculated every 24 hours as new community data arrives. Higher scores indicate greater platform trustworthiness based on real user experience data.',
            factors: Object.entries(TRUST_WEIGHTS).map(([key, weight]) => ({
              key,
              weight,
              weightPct: `${(weight * 100).toFixed(0)}%`,
            })),
          },
        },
      })
    }
  )

  // ─── POST /trust-index/recalculate ────────────────────────────────────────
  // Internal/admin endpoint — triggers score recalculation for a platform
  app.post(
    '/trust-index/recalculate',
    {
      schema: {
        tags: ['Trust Index'],
        summary: '[Internal] Trigger Trust Index recalculation for a platform',
        body: {
          type: 'object',
          required: ['platformId', 'adminSecret'],
          properties: {
            platformId: { type: 'string', format: 'uuid' },
            adminSecret: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { platformId, adminSecret } = request.body as {
        platformId: string
        adminSecret: string
      }

      // Simple shared secret for internal calls — in production use JWT with admin role
      if (!env.ADMIN_SECRET || !constantTimeCompare(adminSecret, env.ADMIN_SECRET)) {
        return reply.code(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Invalid admin secret' },
        })
      }

      // The scoring logic — this gets called by cron job / BullMQ worker in production
      const scoreData = await dbQuery(sql`
        WITH redemption_data AS (
          SELECT
            platform_id,
            COUNT(*) AS total,
            AVG(EXTRACT(EPOCH FROM (completed_at - submitted_at)) / 86400) AS avg_days,
            COUNT(*) FILTER (WHERE status = 'rejected')::numeric / NULLIF(COUNT(*), 0) AS rejection_rate
          FROM redemptions
          WHERE platform_id = ${platformId}
            AND submitted_at > NOW() - INTERVAL '90 days'
            AND status IN ('completed', 'rejected')
          GROUP BY platform_id
        ),
        tos_data AS (
          SELECT
            platform_id,
            COUNT(*) FILTER (WHERE change_severity = 'major') AS major_changes,
            COUNT(*) FILTER (WHERE change_severity = 'moderate') AS moderate_changes
          FROM tos_snapshots
          WHERE platform_id = ${platformId}
            AND captured_at > NOW() - INTERVAL '90 days'
          GROUP BY platform_id
        ),
        community_data AS (
          SELECT
            platform_id,
            COUNT(*) AS total_signals,
            AVG(CASE WHEN sentiment = 'positive' THEN 100 WHEN sentiment = 'neutral' THEN 50 ELSE 0 END) AS satisfaction_score
          FROM platform_community_signals
          WHERE platform_id = ${platformId}
            AND created_at > NOW() - INTERVAL '90 days'
          GROUP BY platform_id
        )
        SELECT
          -- Redemption speed score: 100 = next day, 0 = 30+ days
          GREATEST(0, LEAST(100,
            100 - COALESCE(rd.avg_days, 15) * 4
          ))::numeric(5,2) AS redemption_speed_score,
          -- Rejection rate score: 100 = 0% rejection, 0 = 50%+ rejection
          GREATEST(0, LEAST(100,
            100 - COALESCE(rd.rejection_rate, 0) * 200
          ))::numeric(5,2) AS redemption_rejection_rate_score,
          -- TOS stability: major changes heavily penalized
          GREATEST(0, LEAST(100,
            100 - COALESCE(td.major_changes, 0) * 20
                - COALESCE(td.moderate_changes, 0) * 5
          ))::numeric(5,2) AS tos_stability_score,
          -- Community satisfaction (0-100 from signal data)
          COALESCE(cd.satisfaction_score, 50)::numeric(5,2) AS community_satisfaction_score,
          COALESCE(rd.total, 0) AS sample_size
        FROM platforms p
        LEFT JOIN redemption_data rd ON rd.platform_id = p.id
        LEFT JOIN tos_data td ON td.platform_id = p.id
        LEFT JOIN community_data cd ON cd.platform_id = p.id
        WHERE p.id = ${platformId}
      `)

      if (!scoreData.rows.length) {
        return reply.code(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Platform not found' },
        })
      }

      const scores = scoreData.rows[0] as Record<string, number>

      const overall =
        (scores['redemption_speed_score'] ?? 50) * TRUST_WEIGHTS.redemption_speed +
        (scores['redemption_rejection_rate_score'] ?? 50) * TRUST_WEIGHTS.redemption_rejection_rate +
        (scores['tos_stability_score'] ?? 50) * TRUST_WEIGHTS.tos_stability +
        50 * TRUST_WEIGHTS.bonus_generosity +  // placeholder until bonus data pipeline
        (scores['community_satisfaction_score'] ?? 50) * TRUST_WEIGHTS.community_satisfaction +
        50 * TRUST_WEIGHTS.support_responsiveness + // placeholder
        75 * TRUST_WEIGHTS.regulatory_standing // default assumption for licensed platforms

      await dbQuery(sql`
        INSERT INTO trust_index_scores
          (platform_id, overall_score, redemption_speed_score, redemption_rejection_rate_score,
           tos_stability_score, bonus_generosity_score, community_satisfaction_score,
           support_responsiveness_score, regulatory_standing_score, sample_size, calculated_at)
        VALUES
          (
            ${platformId},
            ${Math.round(overall * 100) / 100},
            ${scores['redemption_speed_score'] ?? 50},
            ${scores['redemption_rejection_rate_score'] ?? 50},
            ${scores['tos_stability_score'] ?? 50},
            50, -- bonus_generosity placeholder
            ${scores['community_satisfaction_score'] ?? 50},
            50, -- support_responsiveness placeholder
            75, -- regulatory_standing placeholder
            ${scores['sample_size'] ?? 0},
            NOW()
          )
      `)

      return reply.send({
        success: true,
        data: { recalculated: true, overall: Math.round(overall * 100) / 100 },
      })
    }
  )
}

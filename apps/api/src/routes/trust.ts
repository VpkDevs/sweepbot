/**
 * Trust Index API — SweepBot
 *
 * The SweepBot Trust Index scores sweepstakes casino platforms 0–100
 * across 7 independently weighted factors derived from real community data.
 *
 * This is informational intelligence — not gambling advice.
 * See /docs/TRUST_INDEX_METHODOLOGY.md for full scoring methodology.
 *
 * Endpoints:
 *   GET  /trust-index                  — Ranked list with user context overlay
 *   GET  /trust-index/leaderboard      — Top platforms, score distribution
 *   GET  /trust-index/:platformId      — Full detail + history + user context
 *   GET  /trust-index/:platformId/percentile — Where this platform ranks
 *   GET  /trust-index/alerts           — User's active score change alerts
 *   POST /trust-index/alerts           — Subscribe to a platform's score changes
 *   DELETE /trust-index/alerts/:id     — Remove an alert subscription
 *   POST /trust-index/recalculate      — [Admin] Trigger score recalculation
 *   POST /trust-index/recalculate-all  — [Admin] Recalculate all active platforms
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { query as dbQuery, unsafeQuery } from '../db/client.js'
import { sql } from 'drizzle-orm'
import { env } from '../utils/env.js'
import { constantTimeCompare } from '@sweepbot/utils'
import { requireAuth, optionalAuth } from '../middleware/auth.js'

// ============================================================================
// Scoring Weights — sum to 1.0 exactly
// See TRUST_INDEX_METHODOLOGY.md for rationale behind each weight
// ============================================================================

const TRUST_WEIGHTS = {
  redemption_speed:         0.25,  // #1 pain point: payout delay
  redemption_rejection_rate: 0.20, // #2 pain point: rejected payouts
  tos_stability:             0.15, // retroactive rule changes = red flag
  community_satisfaction:    0.15, // aggregate sentiment
  support_responsiveness:    0.10, // secondary — most users don't need it
  regulatory_standing:       0.10, // baseline legitimacy
  bonus_generosity:          0.05, // nice-to-have, not trust-critical
} as const

type WeightKey = keyof typeof TRUST_WEIGHTS

// ============================================================================
// Scoring Formula Implementations
// Kept alongside the recalculation endpoint for colocation; each formula
// matches the published methodology document exactly.
// ============================================================================

/** Redemption speed score: ≤2 days = 100, ≥14 days = 0, linear interpolation */
function scoreRedemptionSpeed(avgDays: number | null): number {
  if (avgDays == null) return 50 // insufficient data — neutral
  return Math.max(0, Math.min(100, Math.round(100 - (avgDays - 2) * 8)))
}

/** Rejection rate score: 0% = 100, 25%+ = 0 */
function scoreRejectionRate(rejectionRate: number | null): number {
  if (rejectionRate == null) return 50
  return Math.max(0, Math.min(100, Math.round(100 - rejectionRate * 400)))
}

/** TOS stability score: 0 changes = 100, 8+ changes = 0, each change -12 pts */
function scoreTosStability(changesCount: number | null): number {
  if (changesCount == null) return 100 // no monitoring data = assume stable
  return Math.max(0, Math.min(100, Math.round(100 - changesCount * 12)))
}

/** Community satisfaction: weighted average rating (1-5) mapped to 0-100 */
function scoreCommunityRating(weightedAvg: number | null): number {
  if (weightedAvg == null) return 50
  return Math.max(0, Math.min(100, Math.round(((weightedAvg - 1) / 4) * 100)))
}

/** Bonus generosity: lower wagering requirements = higher score */
function scoreBonusGenerosity(avgWrMultiplier: number | null): number {
  if (avgWrMultiplier == null) return 50
  return Math.max(0, Math.min(100, Math.round(100 - (avgWrMultiplier - 1) * 10)))
}

/**
 * Composite score — weights auto-normalize if a component has insufficient data
 * and is set to null. Weight is redistributed proportionally to data-bearing components.
 */
function computeCompositeScore(
  components: Partial<Record<WeightKey, number | null>>
): { score: number; activatedWeights: Record<string, number> } {
  let weightedSum  = 0
  let totalWeight  = 0
  const activated: Record<string, number> = {}

  for (const [key, weight] of Object.entries(TRUST_WEIGHTS) as [WeightKey, number][]) {
    const val = components[key]
    if (val != null) {
      weightedSum += val * weight
      totalWeight += weight
      activated[key] = weight
    }
  }

  const score = totalWeight > 0
    ? Math.round((weightedSum / totalWeight) * 100) / 100
    : 0

  return { score, activatedWeights: activated }
}

/** Map a 0-100 composite score to its tier label */
function scoreTier(score: number): string {
  if (score >= 85) return 'excellent'
  if (score >= 70) return 'good'
  if (score >= 55) return 'fair'
  if (score >= 40) return 'concerning'
  return 'poor'
}

/** Certification eligibility: score ≥ 75 with sufficient data */
function certificationEligible(score: number, sampleSize: number): boolean {
  return score >= 75 && sampleSize >= 30
}

// ============================================================================
// Query Schemas
// ============================================================================

const TrustQuerySchema = z.object({
  tier:       z.enum(['excellent', 'good', 'fair', 'concerning', 'poor']).optional(),
  minScore:   z.coerce.number().min(0).max(100).optional(),
  maxScore:   z.coerce.number().min(0).max(100).optional(),
  sortBy:     z.enum(['overall_score', 'redemption_speed', 'tos_stability', 'calculated_at', 'rank']).default('overall_score'),
  page:       z.coerce.number().int().min(1).default(1),
  pageSize:   z.coerce.number().int().min(1).max(100).default(20),
  myPlatforms: z.coerce.boolean().default(false), // only show platforms user has played
})

const AlertSchema = z.object({
  platform_id:         z.string().uuid(),
  threshold_direction: z.enum(['above', 'below', 'any']).default('any'),
  threshold_score:     z.number().min(0).max(100).optional(),
})

// ============================================================================
// Route Plugin
// ============================================================================

export async function trustRoutes(app: FastifyInstance): Promise<void> {

  // ── GET / — Ranked list with optional user context ─────────────────────────
  app.get(
    '/',
    {
      schema: {
        tags: ['Trust Index'],
        summary: 'Ranked list of all scored platforms',
        querystring: {
          type: 'object',
          properties: {
            tier:        { type: 'string' },
            minScore:    { type: 'number' },
            maxScore:    { type: 'number' },
            sortBy:      { type: 'string' },
            page:        { type: 'number' },
            pageSize:    { type: 'number' },
            myPlatforms: { type: 'boolean' },
          },
        },
      },
    },
    async (request, reply) => {
      const q      = TrustQuerySchema.parse(request.query)
      const offset = (q.page - 1) * q.pageSize

      // Resolve authenticated user if present (auth is optional on this endpoint)
      await optionalAuth(request, reply)
      const userId: string | null = request.user?.id ?? null

      // Tier filter maps to score range
      const tierRanges: Record<string, [number, number]> = {
        excellent:  [85, 100],
        good:       [70, 84.99],
        fair:       [55, 69.99],
        concerning: [40, 54.99],
        poor:       [0, 39.99],
      }
      const tierRange = q.tier ? tierRanges[q.tier] : null

      const effectiveMin = Math.max(
        q.minScore ?? 0,
        tierRange ? tierRange[0] : 0
      )
      const effectiveMax = Math.min(
        q.maxScore ?? 100,
        tierRange ? tierRange[1] : 100
      )

      const orderMap: Record<string, ReturnType<typeof sql>> = {
        overall_score:    sql`ti.overall_score DESC`,
        redemption_speed: sql`ti.redemption_speed_score DESC`,
        tos_stability:    sql`ti.tos_stability_score DESC`,
        calculated_at:    sql`ti.calculated_at DESC`,
        rank:             sql`ti.overall_score DESC`,
      }
      const orderClause = orderMap[q.sortBy] ?? orderMap['overall_score']!

      const [rows, countResult] = await Promise.all([
        dbQuery(sql`
          WITH latest_scores AS (
            SELECT DISTINCT ON (platform_id)
              platform_id,
              overall_score,
              redemption_speed_score,
              redemption_rejection_rate_score,
              tos_stability_score,
              bonus_generosity_score,
              community_satisfaction_score,
              support_responsiveness_score,
              regulatory_standing_score,
              sample_size,
              calculated_at
            FROM trust_index_scores
            ORDER BY platform_id, calculated_at DESC
          ),
          ranked AS (
            SELECT
              p.id                      AS platform_id,
              p.name                    AS platform_name,
              p.slug                    AS platform_slug,
              p.logo_url,
              p.url                     AS platform_url,
              p.affiliate_url,
              p.is_active               AS platform_active,
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
              RANK()  OVER (ORDER BY ti.overall_score DESC) AS rank,
              -- 30-day score change (positive = improving, negative = declining)
              ti.overall_score - COALESCE(
                (
                  SELECT ti2.overall_score FROM trust_index_scores ti2
                  WHERE ti2.platform_id = p.id
                    AND ti2.calculated_at < NOW() - INTERVAL '30 days'
                  ORDER BY ti2.calculated_at DESC
                  LIMIT 1
                ),
                ti.overall_score
              ) AS score_change_30d,
              -- 7-day sparkline data as JSON array
              (
                SELECT JSON_AGG(
                  JSON_BUILD_OBJECT(
                    'date', DATE(ts.calculated_at),
                    'score', ROUND(ts.overall_score::numeric, 1)
                  ) ORDER BY ts.calculated_at
                )
                FROM trust_index_scores ts
                WHERE ts.platform_id = p.id
                  AND ts.calculated_at > NOW() - INTERVAL '7 days'
              ) AS sparkline_7d,
              -- Certification status
              CASE
                WHEN ti.overall_score >= 75 AND ti.sample_size >= 30 THEN 'eligible'
                WHEN ti.overall_score >= 65 THEN 'provisional'
                ELSE 'not_eligible'
              END AS certification_status
            FROM platforms p
            INNER JOIN latest_scores ti ON ti.platform_id = p.id
            WHERE p.is_active = true
              AND ti.overall_score >= ${effectiveMin}
              AND ti.overall_score <= ${effectiveMax}
              ${userId && q.myPlatforms ? sql`
                AND EXISTS (
                  SELECT 1 FROM sessions s
                  WHERE s.user_id   = ${userId}
                    AND s.platform_id = p.id
                )
              ` : sql``}
          )
          SELECT
            r.*,
            -- Tier label computed from score
            CASE
              WHEN r.overall_score >= 85 THEN 'excellent'
              WHEN r.overall_score >= 70 THEN 'good'
              WHEN r.overall_score >= 55 THEN 'fair'
              WHEN r.overall_score >= 40 THEN 'concerning'
              ELSE 'poor'
            END AS score_tier,
            ${userId ? sql`
              -- User context: has the authenticated user played this platform?
              (
                SELECT COUNT(*) FROM sessions us
                WHERE us.user_id    = ${userId}
                  AND us.platform_id = r.platform_id
              ) AS user_session_count,
              (
                SELECT ROUND(
                  COALESCE(SUM(us.total_won::numeric), 0) /
                  NULLIF(COALESCE(SUM(us.total_wagered::numeric), 0), 0) * 100,
                  2
                )
                FROM sessions us
                WHERE us.user_id    = ${userId}
                  AND us.platform_id = r.platform_id
                  AND us.status      = 'completed'
                  AND us.total_wagered::numeric > 0
              ) AS user_personal_rtp,
              -- Is the user subscribed to alerts for this platform?
              EXISTS (
                SELECT 1 FROM trust_index_alerts ta
                WHERE ta.user_id     = ${userId}
                  AND ta.platform_id  = r.platform_id
                  AND ta.is_active    = true
              ) AS user_has_alert
            ` : sql`
              NULL::integer    AS user_session_count,
              NULL::numeric    AS user_personal_rtp,
              NULL::boolean    AS user_has_alert
            `}
          FROM ranked r
          ORDER BY ${orderClause}
          LIMIT ${q.pageSize} OFFSET ${offset}
        `),
        dbQuery(sql`
          SELECT COUNT(*) AS total
          FROM platforms p
          INNER JOIN (
            SELECT DISTINCT ON (platform_id) platform_id, overall_score
            FROM trust_index_scores
            ORDER BY platform_id, calculated_at DESC
          ) ti ON ti.platform_id = p.id
          WHERE p.is_active = true
            AND ti.overall_score >= ${effectiveMin}
            AND ti.overall_score <= ${effectiveMax}
        `),
      ])

      const total = Number((countResult.rows[0] as { total: string }).total)

      return reply.send({
        success: true,
        data:    rows.rows,
        meta: {
          page:         q.page,
          pageSize:     q.pageSize,
          total,
          hasMore:      offset + rows.rows.length < total,
          filters:      { tier: q.tier, minScore: q.minScore, maxScore: q.maxScore },
          weights:      TRUST_WEIGHTS,
          methodology_url: 'https://sweepbot.app/trust-index/methodology',
        },
      })
    }
  )

  // ── GET /leaderboard — Top platforms + score distribution ──────────────────
  app.get(
    '/leaderboard',
    {
      schema: {
        tags: ['Trust Index'],
        summary: 'Top-10 platforms + score distribution histogram',
      },
    },
    async (_request, reply) => {
      const [top10, distribution, globalStats] = await Promise.all([
        dbQuery(sql`
          SELECT
            p.id, p.name, p.slug, p.logo_url,
            ti.overall_score,
            ti.sample_size,
            RANK() OVER (ORDER BY ti.overall_score DESC) AS rank
          FROM platforms p
          INNER JOIN (
            SELECT DISTINCT ON (platform_id) platform_id, overall_score, sample_size
            FROM trust_index_scores
            ORDER BY platform_id, calculated_at DESC
          ) ti ON ti.platform_id = p.id
          WHERE p.is_active = true
          ORDER BY ti.overall_score DESC
          LIMIT 10
        `),
        dbQuery(sql`
          SELECT
            CASE
              WHEN s.overall_score >= 85 THEN 'excellent'
              WHEN s.overall_score >= 70 THEN 'good'
              WHEN s.overall_score >= 55 THEN 'fair'
              WHEN s.overall_score >= 40 THEN 'concerning'
              ELSE 'poor'
            END AS tier,
            COUNT(*)::integer AS count
          FROM (
            SELECT DISTINCT ON (platform_id) overall_score
            FROM trust_index_scores
            ORDER BY platform_id, calculated_at DESC
          ) s
          GROUP BY tier
          ORDER BY MIN(s.overall_score) DESC
        `),
        dbQuery(sql`
          SELECT
            ROUND(AVG(s.overall_score), 2) AS avg_score,
            ROUND(MIN(s.overall_score), 2) AS min_score,
            ROUND(MAX(s.overall_score), 2) AS max_score,
            COUNT(*)::integer               AS total_scored,
            ROUND(
              PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.overall_score)::numeric,
              2
            ) AS median_score
          FROM (
            SELECT DISTINCT ON (platform_id) overall_score
            FROM trust_index_scores
            ORDER BY platform_id, calculated_at DESC
          ) s
        `),
      ])

      return reply.send({
        success: true,
        data: {
          top_platforms:       top10.rows,
          score_distribution:  distribution.rows,
          global_stats:        globalStats.rows[0] ?? null,
        },
      })
    }
  )

  // ── GET /:platformId — Full platform detail ──────────────────────────────
  app.get(
    '/:platformId',
    {
      schema: {
        tags: ['Trust Index'],
        summary: 'Full Trust Index report with history and user context',
        params: {
          type: 'object',
          properties: { platformId: { type: 'string', format: 'uuid' } },
          required: ['platformId'],
        },
      },
    },
    async (request, reply) => {
      const { platformId } = request.params as { platformId: string }

      // Optional auth — user context enrichment if logged in
      await optionalAuth(request, reply)
      const userId: string | null = request.user?.id ?? null

      const [current, history, dataBreakdown, recentRedemptions, tosChanges] = await Promise.all([
        // Full current score with component breakdown, rank, and certification
        dbQuery(sql`
          SELECT
            p.id              AS platform_id,
            p.name            AS platform_name,
            p.slug            AS platform_slug,
            p.logo_url,
            p.url             AS platform_url,
            p.affiliate_url,
            p.is_active,
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
            -- Global ranking
            RANK()    OVER (ORDER BY ti.overall_score DESC)::integer AS rank,
            (SELECT COUNT(*) FROM platforms WHERE is_active = true)::integer AS total_platforms,
            -- Percentile (0 = bottom, 100 = top)
            ROUND(
              (
                PERCENT_RANK() OVER (ORDER BY ti.overall_score) * 100
              )::numeric,
              1
            ) AS percentile,
            -- Score tier
            CASE
              WHEN ti.overall_score >= 85 THEN 'excellent'
              WHEN ti.overall_score >= 70 THEN 'good'
              WHEN ti.overall_score >= 55 THEN 'fair'
              WHEN ti.overall_score >= 40 THEN 'concerning'
              ELSE 'poor'
            END AS score_tier,
            -- Certification
            CASE
              WHEN ti.overall_score >= 75 AND ti.sample_size >= 30 THEN 'eligible'
              WHEN ti.overall_score >= 65 THEN 'provisional'
              ELSE 'not_eligible'
            END AS certification_status,
            -- 30-day trend
            ti.overall_score - COALESCE(
              (
                SELECT ti2.overall_score FROM trust_index_scores ti2
                WHERE ti2.platform_id = p.id
                  AND ti2.calculated_at < NOW() - INTERVAL '30 days'
                ORDER BY ti2.calculated_at DESC
                LIMIT 1
              ),
              ti.overall_score
            ) AS score_change_30d,
            -- 90-day trend
            ti.overall_score - COALESCE(
              (
                SELECT ti2.overall_score FROM trust_index_scores ti2
                WHERE ti2.platform_id = p.id
                  AND ti2.calculated_at < NOW() - INTERVAL '90 days'
                ORDER BY ti2.calculated_at DESC
                LIMIT 1
              ),
              ti.overall_score
            ) AS score_change_90d
          FROM platforms p
          INNER JOIN (
            SELECT DISTINCT ON (platform_id)
              platform_id, overall_score, redemption_speed_score,
              redemption_rejection_rate_score, tos_stability_score,
              bonus_generosity_score, community_satisfaction_score,
              support_responsiveness_score, regulatory_standing_score,
              sample_size, calculated_at
            FROM trust_index_scores
            ORDER BY platform_id, calculated_at DESC
          ) ti ON ti.platform_id = p.id,
          -- Self-join for RANK/PERCENT_RANK window functions
          (
            SELECT DISTINCT ON (platform_id) platform_id, overall_score
            FROM trust_index_scores
            ORDER BY platform_id, calculated_at DESC
          ) all_platforms
          WHERE p.id = ${platformId}
        `),

        // 90-day score history for sparkline + trend chart
        dbQuery(sql`
          SELECT
            DATE(calculated_at)                    AS date,
            ROUND(overall_score::numeric, 2)       AS overall_score,
            ROUND(redemption_speed_score::numeric, 2)       AS redemption_speed,
            ROUND(redemption_rejection_rate_score::numeric, 2) AS rejection_rate,
            ROUND(tos_stability_score::numeric, 2) AS tos_stability,
            ROUND(community_satisfaction_score::numeric, 2) AS community_satisfaction,
            calculated_at
          FROM trust_index_scores
          WHERE platform_id = ${platformId}
            AND calculated_at > NOW() - INTERVAL '90 days'
          ORDER BY calculated_at ASC
        `),

        // Data source breakdown — what's feeding each factor
        dbQuery(sql`
          SELECT
            'redemption_timing' AS factor,
            COUNT(*) AS data_points,
            ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - submitted_at)) / 86400), 2) AS avg_processing_days,
            COUNT(*) FILTER (WHERE status = 'rejected')::numeric /
              NULLIF(COUNT(*), 0) * 100 AS rejection_rate_pct,
            MAX(submitted_at) AS latest_data_at
          FROM redemptions
          WHERE platform_id = ${platformId}
            AND submitted_at > NOW() - INTERVAL '180 days'
            AND status IN ('completed', 'rejected')
          UNION ALL
          SELECT
            'tos_monitoring',
            COUNT(*),
            COUNT(*) FILTER (WHERE changes_detected = true)::numeric,
            NULL,
            MAX(captured_at)
          FROM tos_snapshots
          WHERE platform_id = ${platformId}
            AND captured_at > NOW() - INTERVAL '90 days'
          UNION ALL
          SELECT
            'community_ratings',
            COUNT(*),
            ROUND(AVG(rating)::numeric, 2),
            NULL,
            MAX(created_at)
          FROM platform_ratings
          WHERE platform_id = ${platformId}
        `),

        // Recent redemption samples (anonymised — only timing, no user data)
        dbQuery(sql`
          SELECT
            EXTRACT(EPOCH FROM (completed_at - submitted_at)) / 86400 AS days_to_complete,
            status,
            DATE_TRUNC('month', submitted_at) AS month
          FROM redemptions
          WHERE platform_id = ${platformId}
            AND submitted_at > NOW() - INTERVAL '90 days'
            AND status IN ('completed', 'rejected')
          ORDER BY submitted_at DESC
          LIMIT 50
        `),

        // TOS change log
        dbQuery(sql`
          SELECT
            captured_at,
            change_severity,
            change_summary,
            affected_sections
          FROM tos_snapshots
          WHERE platform_id    = ${platformId}
            AND changes_detected = true
          ORDER BY captured_at DESC
          LIMIT 20
        `),
      ])

      if (!current.rows.length) {
        return reply.code(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Platform not found or not yet scored' },
        })
      }

      const platformData = current.rows[0] as Record<string, unknown>

      // ── User context overlay (requires authentication) ────────────────────
      let userContext: Record<string, unknown> | null = null
      if (userId) {
        const userStats = await dbQuery(sql`
          SELECT
            COUNT(*)::integer                                AS session_count,
            COALESCE(SUM(spin_count), 0)::integer           AS total_spins,
            COALESCE(SUM(total_wagered::numeric), 0)::float AS total_wagered,
            COALESCE(SUM(total_won::numeric),     0)::float AS total_won,
            CASE
              WHEN SUM(total_wagered::numeric) = 0 THEN NULL
              ELSE ROUND(SUM(total_won::numeric) / SUM(total_wagered::numeric) * 100, 2)
            END::float                                       AS personal_rtp,
            MIN(started_at)                                  AS first_played_at,
            MAX(started_at)                                  AS last_played_at,
            -- How user's personal RTP compares to community RTP
            CASE
              WHEN SUM(total_wagered::numeric) = 0 THEN NULL
              ELSE ROUND(
                SUM(total_won::numeric) / SUM(total_wagered::numeric) * 100
                - ${platformData['overall_score'] as number ?? 80}::numeric,
                2
              )
            END AS rtp_vs_platform_avg,
            -- User's best session on this platform
            (
              SELECT ROUND(rtp::numeric, 2)
              FROM sessions
              WHERE user_id = ${userId}
                AND platform_id = ${platformId}
                AND status = 'completed'
                AND total_wagered::numeric > 0
              ORDER BY rtp DESC
              LIMIT 1
            ) AS best_session_rtp,
            -- Alert subscription
            EXISTS (
              SELECT 1 FROM trust_index_alerts
              WHERE user_id    = ${userId}
                AND platform_id = ${platformId}
                AND is_active   = true
            ) AS has_alert
          FROM sessions
          WHERE user_id    = ${userId}
            AND platform_id = ${platformId}
            AND status      = 'completed'
        `)

        const uRow = userStats.rows[0] as Record<string, unknown> | undefined
        if (uRow) {
          userContext = {
            has_played:         Number(uRow['session_count'] ?? 0) > 0,
            session_count:      Number(uRow['session_count'] ?? 0),
            total_spins:        Number(uRow['total_spins']   ?? 0),
            total_wagered:      Number(uRow['total_wagered'] ?? 0),
            total_won:          Number(uRow['total_won']     ?? 0),
            personal_rtp:       uRow['personal_rtp'] != null ? Number(uRow['personal_rtp']) : null,
            rtp_vs_avg:         uRow['rtp_vs_platform_avg'] != null ? Number(uRow['rtp_vs_platform_avg']) : null,
            best_session_rtp:   uRow['best_session_rtp'] != null ? Number(uRow['best_session_rtp']) : null,
            first_played_at:    uRow['first_played_at'] ?? null,
            last_played_at:     uRow['last_played_at']  ?? null,
            has_alert:          uRow['has_alert'] ?? false,
          }
        }
      }

      return reply.send({
        success: true,
        data: {
          platform:        platformData,
          history:         history.rows,
          data_breakdown:  dataBreakdown.rows,
          redemption_samples: recentRedemptions.rows,
          tos_changes:     tosChanges.rows,
          user_context:    userContext,
          weights:         TRUST_WEIGHTS,
          methodology: {
            version: '1.0',
            url:     'https://sweepbot.app/trust-index/methodology',
            description:
              'The SweepBot Trust Index is a 0-100 composite score derived from 7 independently weighted factors. ' +
              'All data is community-sourced. Scores are informational only — not endorsements or gambling advice.',
            factors: Object.entries(TRUST_WEIGHTS).map(([key, weight]) => ({
              key,
              weight,
              weight_pct:  `${(weight * 100).toFixed(0)}%`,
              description: FACTOR_DESCRIPTIONS[key as WeightKey] ?? '',
            })),
          },
        },
      })
    }
  )

  // ── GET /:platformId/percentile — Rank percentile detail ─────────────────
  app.get(
    '/:platformId/percentile',
    {
      schema: {
        tags: ['Trust Index'],
        summary: 'Percentile ranking for a platform vs all scored platforms',
        params: {
          type: 'object',
          properties: { platformId: { type: 'string', format: 'uuid' } },
          required: ['platformId'],
        },
      },
    },
    async (request, reply) => {
      const { platformId } = request.params as { platformId: string }

      const result = await dbQuery(sql`
        WITH scores AS (
          SELECT DISTINCT ON (platform_id)
            platform_id,
            overall_score,
            redemption_speed_score,
            tos_stability_score,
            community_satisfaction_score
          FROM trust_index_scores
          ORDER BY platform_id, calculated_at DESC
        )
        SELECT
          s.overall_score,
          RANK()         OVER (ORDER BY s.overall_score DESC)::integer AS rank,
          COUNT(*)       OVER ()::integer                               AS total_platforms,
          ROUND(
            PERCENT_RANK() OVER (ORDER BY s.overall_score) * 100,
            1
          ) AS percentile,
          RANK()         OVER (ORDER BY s.redemption_speed_score DESC)::integer  AS redemption_speed_rank,
          RANK()         OVER (ORDER BY s.tos_stability_score DESC)::integer     AS tos_stability_rank,
          RANK()         OVER (ORDER BY s.community_satisfaction_score DESC)::integer AS community_rank,
          -- Beat percentage (what % of platforms does this score beat)
          ROUND(
            (
              COUNT(*) FILTER (WHERE s2.overall_score < s.overall_score)::numeric
              / NULLIF(COUNT(*), 0) * 100
            ),
            1
          ) AS beats_pct
        FROM scores s
        JOIN scores s2 ON true
        WHERE s.platform_id = ${platformId}
        GROUP BY
          s.platform_id, s.overall_score,
          s.redemption_speed_score, s.tos_stability_score,
          s.community_satisfaction_score
      `)

      if (!result.rows.length) {
        return reply.code(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'No score data for this platform' },
        })
      }

      return reply.send({ success: true, data: result.rows[0] })
    }
  )

  // ── GET /alerts — User's alert subscriptions ────────────────────────────
  app.get(
    '/alerts',
    { schema: { tags: ['Trust Index'], summary: 'List user trust alert subscriptions' } },
    async (request, reply) => {
      await requireAuth(request, reply)
      const userId = request.user!.id

      const alerts = await dbQuery(sql`
        SELECT
          ta.id,
          ta.platform_id,
          p.name         AS platform_name,
          p.logo_url     AS platform_logo_url,
          ta.threshold_direction,
          ta.threshold_score,
          ta.is_active,
          ta.created_at,
          ta.last_triggered_at,
          ta.trigger_count,
          -- Current score
          (
            SELECT ROUND(ti.overall_score::numeric, 2)
            FROM trust_index_scores ti
            WHERE ti.platform_id = ta.platform_id
            ORDER BY ti.calculated_at DESC
            LIMIT 1
          ) AS current_score
        FROM trust_index_alerts ta
        INNER JOIN platforms p ON p.id = ta.platform_id
        WHERE ta.user_id = ${userId}
        ORDER BY ta.created_at DESC
      `)

      return reply.send({ success: true, data: alerts.rows })
    }
  )

  // ── POST /alerts — Subscribe to platform score changes ──────────────────
  app.post(
    '/alerts',
    {
      schema: {
        tags: ['Trust Index'],
        summary: 'Subscribe to score change alerts for a platform',
        body: {
          type: 'object',
          required: ['platform_id'],
          properties: {
            platform_id:         { type: 'string', format: 'uuid' },
            threshold_direction: { type: 'string', enum: ['above', 'below', 'any'] },
            threshold_score:     { type: 'number', minimum: 0, maximum: 100 },
          },
        },
      },
    },
    async (request, reply) => {
      await requireAuth(request, reply)
      const userId = request.user!.id
      const body   = AlertSchema.parse(request.body)

      // Upsert alert (idempotent — user can only have one alert per platform)
      await dbQuery(sql`
        INSERT INTO trust_index_alerts
          (user_id, platform_id, threshold_direction, threshold_score, is_active, created_at)
        VALUES
          (${userId}, ${body.platform_id}, ${body.threshold_direction}, ${body.threshold_score ?? null}, true, NOW())
        ON CONFLICT (user_id, platform_id)
        DO UPDATE SET
          threshold_direction = EXCLUDED.threshold_direction,
          threshold_score     = EXCLUDED.threshold_score,
          is_active           = true,
          updated_at          = NOW()
      `)

      return reply.code(201).send({
        success: true,
        data: { message: 'Alert subscription created' },
      })
    }
  )

  // ── DELETE /alerts/:platformId — Remove alert ───────────────────────────
  app.delete(
    '/alerts/:platformId',
    {
      schema: {
        tags: ['Trust Index'],
        summary: 'Remove a trust alert subscription',
        params: {
          type: 'object',
          properties: { platformId: { type: 'string', format: 'uuid' } },
          required: ['platformId'],
        },
      },
    },
    async (request, reply) => {
      await requireAuth(request, reply)
      const userId             = request.user!.id
      const { platformId }     = request.params as { platformId: string }

      await dbQuery(sql`
        UPDATE trust_index_alerts
        SET is_active = false, updated_at = NOW()
        WHERE user_id    = ${userId}
          AND platform_id = ${platformId}
      `)

      return reply.send({ success: true, data: { message: 'Alert removed' } })
    }
  )

  // ── POST /recalculate — [Admin] Single platform recalc ──────────────────
  app.post(
    '/recalculate',
    {
      schema: {
        tags: ['Trust Index'],
        summary: '[Admin] Trigger Trust Index recalculation for a platform',
        body: {
          type: 'object',
          required: ['platformId', 'adminSecret'],
          properties: {
            platformId:   { type: 'string', format: 'uuid' },
            adminSecret:  { type: 'string' },
            // Optional manual overrides for factors not yet automated
            override_support_responsiveness: { type: 'number', minimum: 0, maximum: 100 },
            override_regulatory_standing:    { type: 'number', minimum: 0, maximum: 100 },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        platformId:  string
        adminSecret: string
        override_support_responsiveness?: number
        override_regulatory_standing?: number
      }

      if (!env.ADMIN_SECRET || !constantTimeCompare(body.adminSecret, env.ADMIN_SECRET)) {
        return reply.code(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Invalid admin secret' },
        })
      }

      const result = await recalculatePlatformScore(
        body.platformId,
        body.override_support_responsiveness,
        body.override_regulatory_standing,
      )

      return reply.send({ success: true, data: result })
    }
  )

  // ── POST /recalculate-all — [Admin] Batch recalculate ────────────────────
  app.post(
    '/recalculate-all',
    {
      schema: {
        tags: ['Trust Index'],
        summary: '[Admin] Recalculate Trust Index for all active platforms',
        body: {
          type: 'object',
          required: ['adminSecret'],
          properties: {
            adminSecret: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { adminSecret } = request.body as { adminSecret: string }

      if (!env.ADMIN_SECRET || !constantTimeCompare(adminSecret, env.ADMIN_SECRET)) {
        return reply.code(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Invalid admin secret' },
        })
      }

      const activePlatforms = await dbQuery(sql`
        SELECT id FROM platforms WHERE is_active = true
      `)

      const results = await Promise.allSettled(
        (activePlatforms.rows as { id: string }[]).map((p) =>
          recalculatePlatformScore(p.id)
        )
      )

      const succeeded = results.filter((r) => r.status === 'fulfilled').length
      const failed    = results.filter((r) => r.status === 'rejected').length

      return reply.send({
        success: true,
        data: {
          total:     activePlatforms.rows.length,
          succeeded,
          failed,
          message:   `Recalculated ${succeeded} platforms (${failed} failed)`,
        },
      })
    }
  )
}

// ============================================================================
// Core Scoring Engine
// ============================================================================

/**
 * Pulls raw factor data from the DB, runs each scoring formula,
 * weights and combines into a composite score, then upserts to
 * trust_index_scores. Used by both single and batch recalculate endpoints.
 */
async function recalculatePlatformScore(
  platformId: string,
  overrideSupportResponsiveness?: number,
  overrideRegulatoryStanding?: number,
): Promise<{
  platform_id: string
  overall_score: number
  components: Record<string, number | null>
  sample_size: number
}> {
  // ── Pull factor data in parallel ────────────────────────────────────────
  const [redemptionData, tosData, communityData, bonusData] = await Promise.all([
    // Redemption timing + rejection rate (last 6 months)
    dbQuery(sql`
      SELECT
        AVG(EXTRACT(EPOCH FROM (completed_at - submitted_at)) / 86400)     AS avg_processing_days,
        COUNT(*)::integer                                                    AS total_redemptions,
        COUNT(*) FILTER (WHERE status = 'rejected')::numeric /
          NULLIF(COUNT(*) FILTER (WHERE status IN ('completed', 'rejected')), 0) AS rejection_rate
      FROM redemptions
      WHERE platform_id  = ${platformId}
        AND submitted_at > NOW() - INTERVAL '180 days'
        AND status       IN ('completed', 'rejected')
    `),

    // TOS change count (last 12 months)
    dbQuery(sql`
      SELECT COUNT(*) FILTER (WHERE changes_detected = true)::integer AS changes_12mo
      FROM tos_snapshots
      WHERE platform_id = ${platformId}
        AND captured_at > NOW() - INTERVAL '12 months'
    `),

    // Community ratings — time-decay weighted average
    dbQuery(sql`
      SELECT
        SUM(rating::numeric * (1.0 / (1.0 + EXTRACT(EPOCH FROM (NOW() - created_at)) / (180 * 86400))))
          / NULLIF(SUM(1.0 / (1.0 + EXTRACT(EPOCH FROM (NOW() - created_at)) / (180 * 86400))), 0)
          AS weighted_avg_rating,
        COUNT(*)::integer AS rating_count
      FROM platform_ratings
      WHERE platform_id = ${platformId}
    `),

    // Bonus wagering requirement data
    dbQuery(sql`
      SELECT AVG(wagering_requirement::numeric / NULLIF(bonus_amount::numeric, 0)) AS avg_wr_multiplier
      FROM platform_bonuses
      WHERE platform_id = ${platformId}
        AND created_at  > NOW() - INTERVAL '12 months'
    `),
  ])

  const rd  = (redemptionData.rows[0]  ?? {}) as Record<string, string | null>
  const td  = (tosData.rows[0]         ?? {}) as Record<string, string | null>
  const cd  = (communityData.rows[0]   ?? {}) as Record<string, string | null>
  const bd  = (bonusData.rows[0]       ?? {}) as Record<string, string | null>

  const avgDays        = rd['avg_processing_days'] != null ? Number(rd['avg_processing_days'])  : null
  const rejectionRate  = rd['rejection_rate']      != null ? Number(rd['rejection_rate'])        : null
  const totalReds      = Number(rd['total_redemptions'] ?? 0)
  const tosChanges     = td['changes_12mo']        != null ? Number(td['changes_12mo'])          : null
  const communityRating = cd['weighted_avg_rating'] != null ? Number(cd['weighted_avg_rating'])  : null
  const ratingCount    = Number(cd['rating_count'] ?? 0)
  const avgWrMult      = bd['avg_wr_multiplier']   != null ? Number(bd['avg_wr_multiplier'])     : null

  // ── Compute individual factor scores ─────────────────────────────────────
  const components: Record<WeightKey, number | null> = {
    redemption_speed:          totalReds >= 20 ? scoreRedemptionSpeed(avgDays)         : null,
    redemption_rejection_rate: totalReds >= 30 ? scoreRejectionRate(rejectionRate)     : null,
    tos_stability:             tosChanges != null ? scoreTosStability(tosChanges)      : null,
    community_satisfaction:    ratingCount >= 15 ? scoreCommunityRating(communityRating) : null,
    bonus_generosity:          avgWrMult != null ? scoreBonusGenerosity(avgWrMult)     : null,
    // Manual overrides for factors not yet automated; defaults are mid-range
    support_responsiveness:    overrideSupportResponsiveness ?? 50,
    regulatory_standing:       overrideRegulatoryStanding    ?? 75,
  }

  const { score: overallScore } = computeCompositeScore(components)

  // ── Upsert into trust_index_scores ───────────────────────────────────────
  await dbQuery(sql`
    INSERT INTO trust_index_scores (
      platform_id,
      overall_score,
      redemption_speed_score,
      redemption_rejection_rate_score,
      tos_stability_score,
      bonus_generosity_score,
      community_satisfaction_score,
      support_responsiveness_score,
      regulatory_standing_score,
      sample_size,
      calculated_at
    ) VALUES (
      ${platformId},
      ${overallScore},
      ${components.redemption_speed           ?? 50},
      ${components.redemption_rejection_rate  ?? 50},
      ${components.tos_stability              ?? 100},
      ${components.bonus_generosity           ?? 50},
      ${components.community_satisfaction     ?? 50},
      ${components.support_responsiveness     ?? 50},
      ${components.regulatory_standing        ?? 75},
      ${totalReds},
      NOW()
    )
  `)

  // ── Fire alerts if score crossed a threshold ──────────────────────────────
  // Asynchronously (don't await) — alert delivery failures shouldn't block the response
  fireScoreAlerts(platformId, overallScore).catch(console.error)

  return {
    platform_id:   platformId,
    overall_score: overallScore,
    components,
    sample_size:   totalReds,
  }
}

/**
 * Checks trust_index_alerts and queues notifications for any subscribers
 * whose threshold was crossed by the new score.
 */
async function fireScoreAlerts(platformId: string, newScore: number): Promise<void> {
  const prevScore = await dbQuery(sql`
    SELECT overall_score
    FROM trust_index_scores
    WHERE platform_id  = ${platformId}
    ORDER BY calculated_at DESC
    OFFSET 1
    LIMIT 1
  `)

  const prev = (prevScore.rows[0] as { overall_score: number } | undefined)?.overall_score ?? newScore

  const alerts = await dbQuery(sql`
    SELECT user_id, threshold_direction, threshold_score
    FROM trust_index_alerts
    WHERE platform_id = ${platformId}
      AND is_active   = true
  `)

  for (const alert of alerts.rows as Array<{
    user_id: string
    threshold_direction: string
    threshold_score: number | null
  }>) {
    let shouldFire = false

    if (alert.threshold_direction === 'any' && Math.abs(newScore - prev) >= 3) {
      shouldFire = true
    } else if (alert.threshold_direction === 'below' && alert.threshold_score != null) {
      shouldFire = prev >= alert.threshold_score && newScore < alert.threshold_score
    } else if (alert.threshold_direction === 'above' && alert.threshold_score != null) {
      shouldFire = prev < alert.threshold_score && newScore >= alert.threshold_score
    }

    if (shouldFire) {
      await dbQuery(sql`
        INSERT INTO notifications (user_id, type, title, message, data, created_at)
        VALUES (
          ${alert.user_id},
          'trust_score_change',
          'Trust Index Update',
          ${`Trust score changed from ${prev.toFixed(1)} → ${newScore.toFixed(1)}`},
          ${JSON.stringify({ platform_id: platformId, prev_score: prev, new_score: newScore })}::jsonb,
          NOW()
        )
      `)

      await dbQuery(sql`
        UPDATE trust_index_alerts
        SET last_triggered_at = NOW(),
            trigger_count     = trigger_count + 1
        WHERE user_id    = ${alert.user_id}
          AND platform_id = ${platformId}
      `)
    }
  }
}

// ============================================================================
// Factor Descriptions (used in methodology response)
// ============================================================================

const FACTOR_DESCRIPTIONS: Record<WeightKey, string> = {
  redemption_speed:
    'Average days from redemption request to receipt. Faster processing = higher score. Scored 0-100: ≤2 days = 100, ≥14 days = 0.',
  redemption_rejection_rate:
    'Percentage of redemption requests rejected. Lower rejection rates = higher score. 0% rejections = 100, 25%+ = 0.',
  tos_stability:
    'How often the platform changes its Terms of Service. More changes = lower score. Each major change deducts 12 points from 100.',
  community_satisfaction:
    'Time-decay weighted average of user star ratings (1-5). Recent ratings count more. Maps linearly from 1★=0 to 5★=100.',
  support_responsiveness:
    'How quickly and effectively the platform resolves support tickets. Scored via editorial research and community reports.',
  regulatory_standing:
    'Licensing status, compliance history, and legal standing. Updated quarterly via manual research.',
  bonus_generosity:
    'Average wagering requirement multiple relative to bonus amount. Lower wagering requirements = higher score.',
}

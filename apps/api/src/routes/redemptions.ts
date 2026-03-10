import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { query as dbQuery, unsafeQuery } from '../db/client.js'
import { requireAuth } from '../middleware/auth.js'
import { sql } from 'drizzle-orm'
import { PaginationSchema } from '../lib/common-schemas.js'

const CreateRedemptionBody = z.object({
  userPlatformId: z.string().uuid(),
  platformId: z.string().uuid(),
  amountSc: z.number().positive(),
  paymentMethod: z.enum([
    'paypal',
    'check',
    'bank_transfer',
    'crypto',
    'gift_card',
    'visa_reward',
    'other',
  ]),
  submittedAt: z.string().datetime().optional(),
  notes: z.string().max(1000).optional(),
})

const UpdateRedemptionBody = z.object({
  status: z.enum(['pending', 'processing', 'completed', 'rejected', 'cancelled']).optional(),
  completedAt: z.string().datetime().optional(),
  rejectedAt: z.string().datetime().optional(),
  rejectionReason: z.string().max(1000).optional(),
  amountUsd: z.number().positive().optional(),
  notes: z.string().max(1000).optional(),
})

const RedemptionListQuery = z.object({
  platformId: z.string().uuid().optional(),
  status: z
    .enum(['pending', 'processing', 'completed', 'rejected', 'cancelled'])
    .optional(),
  paymentMethod: z.string().optional(),
  ...PaginationSchema.shape,
})

export async function redemptionRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preValidation', requireAuth)

  // ─── POST /redemptions ────────────────────────────────────────────────────
  app.post(
    '/redemptions',
    {
      schema: {
        tags: ['Redemptions'],
        summary: 'Log a new redemption request',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['userPlatformId', 'platformId', 'amountSc', 'paymentMethod'],
          properties: {
            userPlatformId: { type: 'string', format: 'uuid' },
            platformId: { type: 'string', format: 'uuid' },
            amountSc: { type: 'number', minimum: 0 },
            paymentMethod: { type: 'string' },
            submittedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = request.user!.id
      const body = CreateRedemptionBody.parse(request.body)

      const result = await dbQuery(sql`
        INSERT INTO redemptions
          (user_id, user_platform_id, platform_id, amount_sc, payment_method, submitted_at, notes)
        VALUES
          (
            ${userId},
            ${body.userPlatformId},
            ${body.platformId},
            ${body.amountSc},
            ${body.paymentMethod},
            ${body.submittedAt ? new Date(body.submittedAt) : new Date()},
            ${body.notes ?? null}
          )
        RETURNING *
      `)

      return reply.code(201).send({ success: true, data: result.rows[0] ?? null })
    }
  )

  // ─── PATCH /redemptions/:id ───────────────────────────────────────────────
  app.patch(
    '/redemptions/:id',
    {
      schema: {
        tags: ['Redemptions'],
        summary: 'Update a redemption status (mark completed, rejected, etc.)',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: { id: { type: 'string', format: 'uuid' } },
          required: ['id'],
        },
      },
    },
    async (request, reply) => {
      const userId = request.user!.id
      const { id } = request.params as { id: string }
      const body = UpdateRedemptionBody.parse(request.body)

      const updates: string[] = ['updated_at = NOW()']
      const values: unknown[] = []
      let idx = 1

      if (body.status !== undefined) {
        updates.push(`status = $${idx++}`)
        values.push(body.status)
      }
      if (body.completedAt !== undefined) {
        updates.push(`completed_at = $${idx++}`)
        values.push(new Date(body.completedAt))
      }
      if (body.rejectedAt !== undefined) {
        updates.push(`rejected_at = $${idx++}`)
        values.push(new Date(body.rejectedAt))
      }
      if (body.rejectionReason !== undefined) {
        updates.push(`rejection_reason = $${idx++}`)
        values.push(body.rejectionReason)
      }
      if (body.amountUsd !== undefined) {
        updates.push(`amount_usd = $${idx++}`)
        values.push(body.amountUsd)
      }
      if (body.notes !== undefined) {
        updates.push(`notes = $${idx++}`)
        values.push(body.notes)
      }

      values.push(id, userId)
      const result = await unsafeQuery(
        `UPDATE redemptions SET ${updates.join(', ')} WHERE id = $${idx++} AND user_id = $${idx} RETURNING *`,
        values
      )

      if (!result.rows.length) {
        return reply.code(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Redemption not found' },
        })
      }

      return reply.send({ success: true, data: result.rows[0] ?? null })
    }
  )

  // ─── GET /redemptions ─────────────────────────────────────────────────────
  app.get(
    '/redemptions',
    {
      schema: {
        tags: ['Redemptions'],
        summary: 'List user redemptions',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const userId = request.user!.id
      const query = RedemptionListQuery.parse(request.query)
      const offset = (query.page - 1) * query.pageSize

      const platformFilter = query.platformId
        ? sql`AND r.platform_id = ${query.platformId}`
        : sql``

      const statusFilter = query.status ? sql`AND r.status = ${query.status}` : sql``

      const rows = await dbQuery(sql`
        SELECT
          r.*,
          -- Compute processing days inline
          CASE
            WHEN r.completed_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (r.completed_at - r.submitted_at)) / 86400
            WHEN r.rejected_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (r.rejected_at - r.submitted_at)) / 86400
            ELSE EXTRACT(EPOCH FROM (NOW() - r.submitted_at)) / 86400
          END AS processing_days,
          p.name AS platform_name,
          p.logo_url AS platform_logo_url,
          p.min_redemption_sc,
          p.max_redemption_sc
        FROM redemptions r
        INNER JOIN platforms p ON p.id = r.platform_id
        WHERE r.user_id = ${userId}
          ${platformFilter} ${statusFilter}
        ORDER BY r.submitted_at DESC
        LIMIT ${query.pageSize} OFFSET ${offset}
      `)

      return reply.send({ success: true, data: rows.rows })
    }
  )

  // ─── GET /redemptions/stats ───────────────────────────────────────────────
  app.get(
    '/redemptions/stats',
    {
      schema: {
        tags: ['Redemptions'],
        summary: 'Aggregate redemption stats for the authenticated user',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const userId = request.user!.id

      const stats = await dbQuery(sql`
        SELECT
          COUNT(*) AS total_redemptions,
          COUNT(*) FILTER (WHERE status = 'completed') AS completed_count,
          COUNT(*) FILTER (WHERE status = 'rejected') AS rejected_count,
          COUNT(*) FILTER (WHERE status IN ('pending', 'processing')) AS pending_count,
          ROUND(SUM(amount_sc) FILTER (WHERE status = 'completed'), 2) AS total_sc_redeemed,
          ROUND(SUM(amount_usd) FILTER (WHERE status = 'completed' AND amount_usd IS NOT NULL), 2) AS total_usd_received,
          ROUND(
            AVG(
              EXTRACT(EPOCH FROM (completed_at - submitted_at)) / 86400
            ) FILTER (WHERE status = 'completed' AND completed_at IS NOT NULL),
            2
          ) AS avg_processing_days,
          ROUND(
            MIN(
              EXTRACT(EPOCH FROM (completed_at - submitted_at)) / 86400
            ) FILTER (WHERE status = 'completed' AND completed_at IS NOT NULL),
            2
          ) AS fastest_processing_days,
          ROUND(
            MAX(
              EXTRACT(EPOCH FROM (completed_at - submitted_at)) / 86400
            ) FILTER (WHERE status = 'completed' AND completed_at IS NOT NULL),
            2
          ) AS slowest_processing_days
        FROM redemptions
        WHERE user_id = ${userId}
      `)

      return reply.send({ success: true, data: stats.rows[0] ?? null })
    }
  )

  // ─── GET /redemptions/community-benchmarks ────────────────────────────────
  // Crowdsourced redemption timing data — one of SweepBot's killer features
  app.get(
    '/redemptions/community-benchmarks',
    {
      schema: {
        tags: ['Redemptions'],
        summary: 'Community-aggregated redemption processing times by platform',
      },
    },
    async (_request, reply) => {
      const rows = await dbQuery(sql`
        SELECT
          p.id AS platform_id,
          p.name AS platform_name,
          p.logo_url,
          r.payment_method,
          COUNT(*) AS sample_size,
          ROUND(
            AVG(EXTRACT(EPOCH FROM (completed_at - submitted_at)) / 86400),
            2
          ) AS avg_processing_days,
          ROUND(
            PERCENTILE_CONT(0.5) WITHIN GROUP (
              ORDER BY EXTRACT(EPOCH FROM (completed_at - submitted_at)) / 86400
            ),
            2
          ) AS median_processing_days,
          ROUND(
            PERCENTILE_CONT(0.9) WITHIN GROUP (
              ORDER BY EXTRACT(EPOCH FROM (completed_at - submitted_at)) / 86400
            ),
            2
          ) AS p90_processing_days,
          ROUND(
            COUNT(*) FILTER (WHERE status = 'rejected')::numeric / NULLIF(COUNT(*), 0) * 100,
            2
          ) AS rejection_rate_pct,
          MAX(completed_at) AS most_recent_data_point
        FROM redemptions r
        INNER JOIN platforms p ON p.id = r.platform_id
        WHERE r.status IN ('completed', 'rejected')
          AND r.submitted_at > NOW() - INTERVAL '90 days'
        GROUP BY p.id, p.name, p.logo_url, r.payment_method
        HAVING COUNT(*) >= 5
        ORDER BY p.name ASC, r.payment_method ASC
      `)

      return reply.send({ success: true, data: rows.rows })
    }
  )
}

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { query as dbQuery, unsafeQuery } from '../db/client.js'
import { requireAuth } from '../middleware/auth.js'
import { sql } from 'drizzle-orm'
import { PaginationSchema, UuidParamsSchema } from '../lib/common-schemas.js'

const SessionParamsSchema = UuidParamsSchema

const CreateSessionBody = z.object({
  platformId: z.string().uuid(),
  userPlatformId: z.string().uuid(),
  startedAt: z.string().datetime().optional(),
  deviceInfo: z
    .object({
      browser: z.string().optional(),
      os: z.string().optional(),
      extensionVersion: z.string().optional(),
    })
    .optional(),
})

const UpdateSessionBody = z.object({
  endedAt: z.string().datetime().optional(),
  totalBets: z.number().int().min(0).optional(),
  totalWagered: z.number().min(0).optional(),
  totalWon: z.number().min(0).optional(),
  startingBalance: z.number().min(0).optional(),
  endingBalance: z.number().min(0).optional(),
  bonusTriggered: z.boolean().optional(),
  bonusPayout: z.number().min(0).optional(),
  gameId: z.string().uuid().optional(),
})

const BatchTransactionsBody = z.object({
  sessionId: z.string().uuid(),
  transactions: z
    .array(
      z.object({
        type: z.enum(['bet', 'win', 'bonus_trigger', 'bonus_payout', 'free_spin', 'purchase']),
        amount: z.number(),
        gameId: z.string().uuid().optional(),
        multiplier: z.number().optional(),
        balanceBefore: z.number().optional(),
        balanceAfter: z.number().optional(),
        occurredAt: z.string().datetime(),
        metadata: z.record(z.unknown()).optional(),
      })
    )
    .min(1)
    .max(500),
})

const SessionListQuery = z.object({
  platformId: z.string().uuid().optional(),
  gameId: z.string().uuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  ...PaginationSchema.shape,
})

export async function sessionRoutes(app: FastifyInstance): Promise<void> {
  // All session routes require authentication
  app.addHook('preValidation', requireAuth)

  // ─── POST /sessions ────────────────────────────────────────────────────────
  app.post(
    '/sessions',
    {
      schema: {
        tags: ['Sessions'],
        summary: 'Start a new play session',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['platformId', 'userPlatformId'],
          properties: {
            platformId: { type: 'string', format: 'uuid' },
            userPlatformId: { type: 'string', format: 'uuid' },
            startedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const body = CreateSessionBody.parse(request.body)
        const userId = request.user!.id

        const result = await dbQuery(sql`
          INSERT INTO sessions
            (user_id, platform_id, user_platform_id, started_at, device_info)
          VALUES
            (
              ${userId},
              ${body.platformId},
              ${body.userPlatformId},
              ${body.startedAt ? new Date(body.startedAt) : new Date()},
              ${JSON.stringify(body.deviceInfo ?? {})}
            )
          RETURNING *
        `)

        return reply.code(201).send({ success: true, data: result.rows[0] ?? null })
      } catch (error) {
        app.log.error({ error }, 'Session creation error')
        return reply.code(500).send({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to create session' },
        })
      }
    }
  )

  // ─── PATCH /sessions/:id ───────────────────────────────────────────────────
  app.patch(
    '/sessions/:id',
    {
      schema: {
        tags: ['Sessions'],
        summary: 'Update a session (end it, update stats)',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: { id: { type: 'string', format: 'uuid' } },
          required: ['id'],
        },
      },
    },
    async (request, reply) => {
      const { id } = SessionParamsSchema.parse(request.params)
      const body = UpdateSessionBody.parse(request.body)
      const userId = request.user!.id

      // Build dynamic SET clause from provided fields only
      const updates: string[] = []
      const values: unknown[] = []
      let paramIdx = 1

      if (body.endedAt !== undefined) {
        updates.push(`ended_at = $${paramIdx++}`)
        values.push(new Date(body.endedAt))
      }
      if (body.totalBets !== undefined) {
        updates.push(`total_bets = $${paramIdx++}`)
        values.push(body.totalBets)
      }
      if (body.totalWagered !== undefined) {
        updates.push(`total_wagered = $${paramIdx++}`)
        values.push(body.totalWagered)
      }
      if (body.totalWon !== undefined) {
        updates.push(`total_won = $${paramIdx++}`)
        values.push(body.totalWon)
      }
      if (body.startingBalance !== undefined) {
        updates.push(`starting_balance = $${paramIdx++}`)
        values.push(body.startingBalance)
      }
      if (body.endingBalance !== undefined) {
        updates.push(`ending_balance = $${paramIdx++}`)
        values.push(body.endingBalance)
      }
      if (body.bonusTriggered !== undefined) {
        updates.push(`bonus_triggered = $${paramIdx++}`)
        values.push(body.bonusTriggered)
      }
      if (body.bonusPayout !== undefined) {
        updates.push(`bonus_payout = $${paramIdx++}`)
        values.push(body.bonusPayout)
      }
      if (body.gameId !== undefined) {
        updates.push(`game_id = $${paramIdx++}`)
        values.push(body.gameId)
      }

      if (!updates.length) {
        return reply.code(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'No fields to update' },
        })
      }

      updates.push(`updated_at = NOW()`)

      // Compute RTP if we have enough data for a closed session
      if (body.endedAt && body.totalWagered !== undefined && body.totalWon !== undefined) {
        const rtp =
          body.totalWagered > 0
            ? Math.round((body.totalWon / body.totalWagered) * 10000) / 100
            : null
        if (rtp !== null) {
          updates.push(`rtp = $${paramIdx++}`)
          values.push(rtp)
        }
      }

      // Add WHERE clause params
      values.push(id, userId)
      const whereId = paramIdx++
      const whereUserId = paramIdx

      const result = await unsafeQuery(
        `UPDATE sessions SET ${updates.join(', ')} WHERE id = $${whereId} AND user_id = $${whereUserId} RETURNING *`,
        values
      )

      if (!result.rows.length) {
        return reply.code(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Session not found' },
        })
      }

      return reply.send({ success: true, data: result.rows[0] ?? null })
    }
  )

  // ─── GET /sessions ─────────────────────────────────────────────────────────
  app.get(
    '/sessions',
    {
      schema: {
        tags: ['Sessions'],
        summary: 'List sessions for the authenticated user',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const query = SessionListQuery.parse(request.query)
      const userId = request.user!.id
      const offset = (query.page - 1) * query.pageSize

      const platformClause = query.platformId
        ? sql`AND s.platform_id = ${query.platformId}`
        : sql``

      const gameClause = query.gameId ? sql`AND s.game_id = ${query.gameId}` : sql``

      const startClause = query.startDate
        ? sql`AND s.started_at >= ${new Date(query.startDate)}`
        : sql``
      const endClause = query.endDate
        ? sql`AND s.started_at <= ${new Date(query.endDate)}`
        : sql``

      const [rows, countResult] = await Promise.all([
        dbQuery(sql`
          SELECT
            s.*,
            p.name AS platform_name,
            p.slug AS platform_slug,
            p.logo_url AS platform_logo_url,
            g.name AS game_name
          FROM sessions s
          INNER JOIN platforms p ON p.id = s.platform_id
          LEFT JOIN games g ON g.id = s.game_id
          WHERE s.user_id = ${userId}
            ${platformClause} ${gameClause} ${startClause} ${endClause}
          ORDER BY s.started_at DESC
          LIMIT ${query.pageSize} OFFSET ${offset}
        `),
        dbQuery(sql`
          SELECT COUNT(*) AS total FROM sessions s
          WHERE s.user_id = ${userId}
            ${platformClause} ${gameClause} ${startClause} ${endClause}
        `),
      ])

      const total = Number((countResult.rows[0] as { total: string } | undefined)?.total ?? '0')

      return reply.send({
        success: true,
        data: rows.rows,
        meta: { page: query.page, pageSize: query.pageSize, total, hasMore: offset + rows.rows.length < total },
      })
    }
  )

  // ─── GET /sessions/:id ─────────────────────────────────────────────────────
  app.get(
    '/sessions/:id',
    {
      schema: {
        tags: ['Sessions'],
        summary: 'Get a single session with all transactions',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: { id: { type: 'string', format: 'uuid' } },
          required: ['id'],
        },
      },
    },
    async (request, reply) => {
      const { id } = SessionParamsSchema.parse(request.params)
      const userId = request.user!.id

      const [session, transactions] = await Promise.all([
        dbQuery(sql`
          SELECT s.*, p.name AS platform_name, p.logo_url AS platform_logo_url
          FROM sessions s
          INNER JOIN platforms p ON p.id = s.platform_id
          WHERE s.id = ${id} AND s.user_id = ${userId}
        `),
        dbQuery(sql`
          SELECT t.*, g.name AS game_name
          FROM transactions t
          LEFT JOIN games g ON g.id = t.game_id
          WHERE t.session_id = ${id}
          ORDER BY t.occurred_at ASC
          LIMIT 1000
        `),
      ])

      if (!session.rows.length) {
        return reply.code(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Session not found' },
        })
      }

      return reply.send({
        success: true,
        data: { ...session.rows[0], transactions: transactions.rows },
      })
    }
  )

  // ─── POST /sessions/transactions/batch ────────────────────────────────────
  // Hot path — called by extension every few seconds during active play
  app.post(
    '/sessions/transactions/batch',
    {
      schema: {
        tags: ['Sessions'],
        summary: 'Batch-insert transactions captured by the browser extension',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['sessionId', 'transactions'],
          properties: {
            sessionId: { type: 'string', format: 'uuid' },
            transactions: { type: 'array', minItems: 1, maxItems: 500 },
          },
        },
      },
    },
    async (request, reply) => {
      const body = BatchTransactionsBody.parse(request.body)
      const userId = request.user!.id

      // Verify session belongs to this user
      const sessionCheck = await dbQuery(sql`
        SELECT id FROM sessions WHERE id = ${body.sessionId} AND user_id = ${userId}
      `)

      if (!sessionCheck.rows.length) {
        return reply.code(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Session not found or unauthorized' },
        })
      }

      // Build VALUES list for bulk insert
      const valuesList = body.transactions.map(
        (t) => sql`(
          ${body.sessionId},
          ${t.type},
          ${t.amount},
          ${t.gameId ?? null},
          ${t.multiplier ?? null},
          ${t.balanceBefore ?? null},
          ${t.balanceAfter ?? null},
          ${new Date(t.occurredAt)},
          ${JSON.stringify(t.metadata ?? {})}
        )`
      )

      await dbQuery(sql`
        INSERT INTO transactions
          (session_id, type, amount, game_id, multiplier, balance_before, balance_after, occurred_at, metadata)
        VALUES ${sql.join(valuesList, sql`, `)}
        ON CONFLICT DO NOTHING
      `)

      // Update session running totals in a single UPDATE
      await dbQuery(sql`
        UPDATE sessions
        SET
          total_bets = total_bets + (
            SELECT COUNT(*) FROM unnest(${body.transactions.map((t) => t.type)}::text[]) AS tx_type
            WHERE tx_type = 'bet'
          ),
          total_wagered = total_wagered + (
            SELECT COALESCE(SUM(amount), 0) FROM unnest(
              ARRAY[${body.transactions.filter((t) => t.type === 'bet').map((t) => t.amount).join(',')}]::numeric[]
            ) AS amount
          ),
          total_won = total_won + (
            SELECT COALESCE(SUM(amount), 0) FROM unnest(
              ARRAY[${body.transactions.filter((t) => t.type === 'win').map((t) => t.amount).join(',')}]::numeric[]
            ) AS amount
          ),
          updated_at = NOW()
        WHERE id = ${body.sessionId}
      `)

      return reply.code(201).send({
        success: true,
        data: { inserted: body.transactions.length },
      })
    }
  )
}

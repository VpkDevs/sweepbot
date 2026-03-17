import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { sql } from 'drizzle-orm'
import { query as dbQuery } from '../db/client.js'
import { requireAuth } from '../middleware/auth.js'

const TaxYearQuery = z.object({
  year: z.coerce.number().int().min(2020).max(2035),
})

const TaxTransactionsQuery = z.object({
  year: z.coerce.number().int().min(2020).max(2035).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(100),
})

function csvEscape(value: unknown): string {
  const s = value == null ? '' : String(value)
  if (/[",\r\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`
  return s
}

/**
 * Tax Center routes.
 *
 * NOTE: The `redemptions` table uses `completed_at` as the completion timestamp.
 * All date expressions use COALESCE(completed_at, submitted_at, created_at) as a fallback chain.
 */
export async function taxRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preValidation', requireAuth)

  // ─── GET /tax/summary ────────────────────────────────────────────────────
  app.get('/summary', async (request, reply) => {
    const userId = request.user!.id
    const { year } = TaxYearQuery.parse(request.query)

    const startDate = `${year}-01-01`
    const endDate = `${year}-12-31`

    const dateExpr = sql`DATE(COALESCE(r.completed_at, r.submitted_at, r.created_at))`

    const totals = await dbQuery(sql`
      SELECT
        COUNT(*)::int AS transaction_count,
        COUNT(DISTINCT r.platform_id)::int AS platforms_count,
        COALESCE(SUM(r.amount_usd) FILTER (WHERE r.amount_usd IS NOT NULL), 0)::float AS total_redemptions_usd
      FROM redemptions r
      WHERE r.user_id = ${userId}
        AND r.status IN ('received', 'completed')
        AND ${dateExpr} BETWEEN ${startDate}::date AND ${endDate}::date
    `)

    const totalsRow = (totals.rows[0] as Record<string, unknown> | undefined) ?? {}
    const totalRedemptionsUsd = Number(totalsRow['total_redemptions_usd'] ?? 0)
    const totalPrizesUsd = 0
    const totalTaxableUsd = totalRedemptionsUsd + totalPrizesUsd

    // Simple blended-rate estimate (UI disclaimer calls this out)
    const estFederal = Math.round(totalTaxableUsd * 0.22 * 100) / 100
    const estState = Math.round(totalTaxableUsd * 0.045 * 100) / 100
    const estTotal = Math.round((estFederal + estState) * 100) / 100
    const effectiveRate =
      totalTaxableUsd > 0 ? Math.round((estTotal / totalTaxableUsd) * 10_000) / 100 : 0

    const monthly = await dbQuery(sql`
      SELECT
        EXTRACT(MONTH FROM COALESCE(r.completed_at, r.submitted_at, r.created_at))::int AS month_num,
        TO_CHAR(COALESCE(r.completed_at, r.submitted_at, r.created_at), 'FMMon') AS month,
        COALESCE(SUM(r.amount_usd) FILTER (WHERE r.amount_usd IS NOT NULL), 0)::float AS redemptions,
        0::float AS prizes,
        COALESCE(SUM(r.amount_usd) FILTER (WHERE r.amount_usd IS NOT NULL), 0)::float AS total
      FROM redemptions r
      WHERE r.user_id = ${userId}
        AND r.status IN ('received', 'completed')
        AND ${dateExpr} BETWEEN ${startDate}::date AND ${endDate}::date
      GROUP BY month_num, month
      ORDER BY month_num ASC
    `)

    const byPlatform = await dbQuery(sql`
      SELECT
        p.name AS name,
        COALESCE(SUM(r.amount_usd) FILTER (WHERE r.amount_usd IS NOT NULL), 0)::float AS amount
      FROM redemptions r
      LEFT JOIN platforms p ON p.id = r.platform_id
      WHERE r.user_id = ${userId}
        AND r.status IN ('received', 'completed')
        AND ${dateExpr} BETWEEN ${startDate}::date AND ${endDate}::date
      GROUP BY p.name
      ORDER BY amount DESC NULLS LAST
    `)

    const platformRows = byPlatform.rows as Array<{ name: string | null; amount: number }>
    const totalForPct = platformRows.reduce((acc, r) => acc + Number(r.amount ?? 0), 0) || 0
    const top = platformRows
      .filter((r) => (r.name ?? '').trim().length > 0)
      .slice(0, 4)
      .map((r) => ({
        name: r.name as string,
        amount: Number(r.amount ?? 0),
        pct: totalForPct > 0 ? (Number(r.amount ?? 0) / totalForPct) * 100 : 0,
      }))

    const topSum = top.reduce((acc, r) => acc + r.amount, 0)
    const othersAmount = Math.max(0, totalForPct - topSum)
    const topPlatforms =
      othersAmount > 0
        ? [
            ...top,
            {
              name: 'Others',
              amount: othersAmount,
              pct: totalForPct > 0 ? (othersAmount / totalForPct) * 100 : 0,
            },
          ]
        : top

    return reply.send({
      success: true,
      data: {
        year,
        total_redemptions_usd: totalRedemptionsUsd,
        total_prizes_usd: totalPrizesUsd,
        total_taxable_usd: totalTaxableUsd,
        est_federal_liability: estFederal,
        est_state_liability: estState,
        est_total_liability: estTotal,
        effective_rate: effectiveRate,
        transaction_count: Number(totalsRow['transaction_count'] ?? 0),
        platforms_count: Number(totalsRow['platforms_count'] ?? 0),
        monthly: monthly.rows,
        top_platforms: topPlatforms,
      },
    })
  })

  // ─── GET /tax/transactions ───────────────────────────────────────────────
  app.get('/transactions', async (request, reply) => {
    const userId = request.user!.id
    const q = TaxTransactionsQuery.parse(request.query)

    const year = q.year ?? new Date().getFullYear()
    const startDate = `${year}-01-01`
    const endDate = `${year}-12-31`
    const offset = (q.page - 1) * q.limit

    const rows = await dbQuery(sql`
      SELECT
        r.id,
        p.name AS platform_name,
        'redemption'::text AS type,
        COALESCE(r.amount_usd, 0)::float AS amount_usd,
        COALESCE(r.completed_at, r.submitted_at, r.created_at) AS date,
        CASE
          WHEN r.status IN ('received', 'completed') THEN 'completed'
          WHEN r.status IN ('rejected', 'cancelled') THEN 'rejected'
          ELSE 'pending'
        END AS status,
        COALESCE(r.payment_method::text, 'other') AS payment_method,
        r.notes
      FROM redemptions r
      LEFT JOIN platforms p ON p.id = r.platform_id
      WHERE r.user_id = ${userId}
        AND DATE(COALESCE(r.completed_at, r.submitted_at, r.created_at))
            BETWEEN ${startDate}::date AND ${endDate}::date
      ORDER BY COALESCE(r.completed_at, r.submitted_at, r.created_at) DESC
      LIMIT ${q.limit} OFFSET ${offset}
    `)

    return reply.send({ success: true, data: rows.rows })
  })

  // ─── GET /tax/monthly ────────────────────────────────────────────────────
  app.get('/monthly', async (request, reply) => {
    const userId = request.user!.id
    const { year } = TaxYearQuery.parse(request.query)

    const startDate = `${year}-01-01`
    const endDate = `${year}-12-31`
    const dateExpr = sql`DATE(COALESCE(r.completed_at, r.submitted_at, r.created_at))`

    const rows = await dbQuery(sql`
      SELECT
        EXTRACT(MONTH FROM COALESCE(r.completed_at, r.submitted_at, r.created_at))::int AS month_num,
        TO_CHAR(COALESCE(r.completed_at, r.submitted_at, r.created_at), 'FMMon') AS month,
        COALESCE(SUM(r.amount_usd) FILTER (WHERE r.amount_usd IS NOT NULL), 0)::float AS redemptions,
        0::float AS prizes,
        COALESCE(SUM(r.amount_usd) FILTER (WHERE r.amount_usd IS NOT NULL), 0)::float AS total
      FROM redemptions r
      WHERE r.user_id = ${userId}
        AND r.status IN ('received', 'completed')
        AND ${dateExpr} BETWEEN ${startDate}::date AND ${endDate}::date
      GROUP BY month_num, month
      ORDER BY month_num ASC
    `)

    return reply.send({ success: true, data: rows.rows })
  })

  // ─── GET /tax/year-over-year ─────────────────────────────────────────────
  app.get('/year-over-year', async (request, reply) => {
    const userId = request.user!.id

    const rows = await dbQuery(sql`
      SELECT
        EXTRACT(YEAR FROM COALESCE(r.completed_at, r.submitted_at, r.created_at))::int AS year,
        COALESCE(SUM(r.amount_usd) FILTER (WHERE r.amount_usd IS NOT NULL AND r.status IN ('received','completed')), 0)::float AS total_redemptions_usd,
        0::float AS total_prizes_usd,
        COALESCE(SUM(r.amount_usd) FILTER (WHERE r.amount_usd IS NOT NULL AND r.status IN ('received','completed')), 0)::float AS total_taxable_usd,
        ROUND(COALESCE(SUM(r.amount_usd) FILTER (WHERE r.amount_usd IS NOT NULL AND r.status IN ('received','completed')), 0) * 0.22, 2)::float AS est_federal_liability,
        ROUND(COALESCE(SUM(r.amount_usd) FILTER (WHERE r.amount_usd IS NOT NULL AND r.status IN ('received','completed')), 0) * 0.045, 2)::float AS est_state_liability,
        COUNT(*) FILTER (WHERE r.status IN ('received','completed'))::int AS transaction_count
      FROM redemptions r
      WHERE r.user_id = ${userId}
      GROUP BY year
      ORDER BY year ASC
    `)

    return reply.send({ success: true, data: rows.rows })
  })

  // ─── GET /tax/export ─────────────────────────────────────────────────────
  // Returns a CSV download (not JSON).
  app.get('/export', async (request, reply) => {
    const userId = request.user!.id
    const { year } = TaxYearQuery.parse(request.query)

    const startDate = `${year}-01-01`
    const endDate = `${year}-12-31`

    const rows = await dbQuery(sql`
      SELECT
        COALESCE(r.completed_at, r.submitted_at, r.created_at) AS date,
        p.name AS platform_name,
        COALESCE(r.amount_usd, 0)::float AS amount_usd,
        COALESCE(r.payment_method::text, 'other') AS payment_method,
        r.status::text AS raw_status,
        r.notes
      FROM redemptions r
      LEFT JOIN platforms p ON p.id = r.platform_id
      WHERE r.user_id = ${userId}
        AND r.status IN ('received', 'completed')
        AND DATE(COALESCE(r.completed_at, r.submitted_at, r.created_at))
            BETWEEN ${startDate}::date AND ${endDate}::date
      ORDER BY COALESCE(r.completed_at, r.submitted_at, r.created_at) DESC
    `)

    const header = ['date', 'platform', 'type', 'amount_usd', 'payment_method', 'status', 'notes']
    const lines = [header.join(',')]
    for (const r of rows.rows as Array<Record<string, unknown>>) {
      lines.push(
        [
          csvEscape(r['date']),
          csvEscape(r['platform_name']),
          csvEscape('redemption'),
          csvEscape(r['amount_usd']),
          csvEscape(r['payment_method']),
          csvEscape(r['raw_status']),
          csvEscape(r['notes']),
        ].join(',')
      )
    }

    const csv = lines.join('\r\n') + '\r\n'
    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="sweepbot-tax-${year}.csv"`)
      .send(csv)
  })
}

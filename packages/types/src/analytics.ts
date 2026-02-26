import { z } from 'zod'

// ─────────────────────────────────────────────────────────────────────────────
// PORTFOLIO OVERVIEW (Command Center)
// ─────────────────────────────────────────────────────────────────────────────

export const PortfolioOverviewSchema = z.object({
  totalPlatforms: z.number().int(),
  activePlatforms: z.number().int(),
  totalSessions: z.number().int(),
  lifetimeWagered: z.number(),
  lifetimeWon: z.number(),
  lifetimeNet: z.number(),
  lifetimeRtpPct: z.number().nullable(),
  totalSpins: z.number().int(),
  lastSessionAt: z.string().datetime().nullable(),
  // Period comparisons
  last7DaysNet: z.number(),
  last30DaysNet: z.number(),
  currentMonthNet: z.number(),
})

export type PortfolioOverview = z.infer<typeof PortfolioOverviewSchema>

// ─────────────────────────────────────────────────────────────────────────────
// RTP ANALYTICS
// ─────────────────────────────────────────────────────────────────────────────

export const RTPBreakdownSchema = z.object({
  platformId: z.string().uuid().nullable(),
  platformName: z.string().nullable(),
  gameId: z.string().uuid().nullable(),
  gameName: z.string().nullable(),
  sessionCount: z.number().int(),
  totalSpins: z.number().int(),
  totalWagered: z.number(),
  totalWon: z.number(),
  netResult: z.number(),
  rtpPct: z.number(),
  confidenceLevel: z.enum(['low', 'medium', 'high']),
  // Statistical bounds (95% CI)
  rtpLowerBound: z.number().nullable(),
  rtpUpperBound: z.number().nullable(),
})

export type RTPBreakdown = z.infer<typeof RTPBreakdownSchema>

export const RTPQueryParamsSchema = z.object({
  platformId: z.string().uuid().optional(),
  gameId: z.string().uuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  groupBy: z.enum(['platform', 'game', 'day', 'week', 'month']).default('platform'),
})

export type RTPQueryParams = z.infer<typeof RTPQueryParamsSchema>

// ─────────────────────────────────────────────────────────────────────────────
// TREND DATA (charts)
// ─────────────────────────────────────────────────────────────────────────────

export const TrendDataPointSchema = z.object({
  date: z.string(),        // ISO date string
  value: z.number(),
  label: z.string().optional(),
})

export type TrendDataPoint = z.infer<typeof TrendDataPointSchema>

export const TrendSeriesSchema = z.object({
  key: z.string(),
  label: z.string(),
  color: z.string().optional(),
  data: z.array(TrendDataPointSchema),
})

export type TrendSeries = z.infer<typeof TrendSeriesSchema>

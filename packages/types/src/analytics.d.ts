import { z } from 'zod'
export declare const PortfolioOverviewSchema: z.ZodObject<
  {
    totalPlatforms: z.ZodNumber
    activePlatforms: z.ZodNumber
    totalSessions: z.ZodNumber
    lifetimeWagered: z.ZodNumber
    lifetimeWon: z.ZodNumber
    lifetimeNet: z.ZodNumber
    lifetimeRtpPct: z.ZodNullable<z.ZodNumber>
    totalSpins: z.ZodNumber
    lastSessionAt: z.ZodNullable<z.ZodString>
    last7DaysNet: z.ZodNumber
    last30DaysNet: z.ZodNumber
    currentMonthNet: z.ZodNumber
  },
  'strip',
  z.ZodTypeAny,
  {
    totalPlatforms: number
    activePlatforms: number
    totalSessions: number
    lifetimeWagered: number
    lifetimeWon: number
    lifetimeNet: number
    lifetimeRtpPct: number | null
    totalSpins: number
    lastSessionAt: string | null
    last7DaysNet: number
    last30DaysNet: number
    currentMonthNet: number
  },
  {
    totalPlatforms: number
    activePlatforms: number
    totalSessions: number
    lifetimeWagered: number
    lifetimeWon: number
    lifetimeNet: number
    lifetimeRtpPct: number | null
    totalSpins: number
    lastSessionAt: string | null
    last7DaysNet: number
    last30DaysNet: number
    currentMonthNet: number
  }
>
export type PortfolioOverview = z.infer<typeof PortfolioOverviewSchema>
export declare const RTPBreakdownSchema: z.ZodObject<
  {
    platformId: z.ZodNullable<z.ZodString>
    platformName: z.ZodNullable<z.ZodString>
    gameId: z.ZodNullable<z.ZodString>
    gameName: z.ZodNullable<z.ZodString>
    sessionCount: z.ZodNumber
    totalSpins: z.ZodNumber
    totalWagered: z.ZodNumber
    totalWon: z.ZodNumber
    netResult: z.ZodNumber
    rtpPct: z.ZodNumber
    confidenceLevel: z.ZodEnum<['low', 'medium', 'high']>
    rtpLowerBound: z.ZodNullable<z.ZodNumber>
    rtpUpperBound: z.ZodNullable<z.ZodNumber>
  },
  'strip',
  z.ZodTypeAny,
  {
    platformId: string | null
    totalWagered: number
    totalWon: number
    gameId: string | null
    netResult: number
    confidenceLevel: 'low' | 'medium' | 'high'
    totalSpins: number
    platformName: string | null
    gameName: string | null
    sessionCount: number
    rtpPct: number
    rtpLowerBound: number | null
    rtpUpperBound: number | null
  },
  {
    platformId: string | null
    totalWagered: number
    totalWon: number
    gameId: string | null
    netResult: number
    confidenceLevel: 'low' | 'medium' | 'high'
    totalSpins: number
    platformName: string | null
    gameName: string | null
    sessionCount: number
    rtpPct: number
    rtpLowerBound: number | null
    rtpUpperBound: number | null
  }
>
export type RTPBreakdown = z.infer<typeof RTPBreakdownSchema>
export declare const RTPQueryParamsSchema: z.ZodObject<
  {
    platformId: z.ZodOptional<z.ZodString>
    gameId: z.ZodOptional<z.ZodString>
    startDate: z.ZodOptional<z.ZodString>
    endDate: z.ZodOptional<z.ZodString>
    groupBy: z.ZodDefault<z.ZodEnum<['platform', 'game', 'day', 'week', 'month']>>
  },
  'strip',
  z.ZodTypeAny,
  {
    groupBy: 'platform' | 'day' | 'week' | 'month' | 'game'
    platformId?: string | undefined
    gameId?: string | undefined
    startDate?: string | undefined
    endDate?: string | undefined
  },
  {
    platformId?: string | undefined
    gameId?: string | undefined
    startDate?: string | undefined
    endDate?: string | undefined
    groupBy?: 'platform' | 'day' | 'week' | 'month' | 'game' | undefined
  }
>
export type RTPQueryParams = z.infer<typeof RTPQueryParamsSchema>
export declare const TrendDataPointSchema: z.ZodObject<
  {
    date: z.ZodString
    value: z.ZodNumber
    label: z.ZodOptional<z.ZodString>
  },
  'strip',
  z.ZodTypeAny,
  {
    value: number
    date: string
    label?: string | undefined
  },
  {
    value: number
    date: string
    label?: string | undefined
  }
>
export type TrendDataPoint = z.infer<typeof TrendDataPointSchema>
export declare const TrendSeriesSchema: z.ZodObject<
  {
    key: z.ZodString
    label: z.ZodString
    color: z.ZodOptional<z.ZodString>
    data: z.ZodArray<
      z.ZodObject<
        {
          date: z.ZodString
          value: z.ZodNumber
          label: z.ZodOptional<z.ZodString>
        },
        'strip',
        z.ZodTypeAny,
        {
          value: number
          date: string
          label?: string | undefined
        },
        {
          value: number
          date: string
          label?: string | undefined
        }
      >,
      'many'
    >
  },
  'strip',
  z.ZodTypeAny,
  {
    data: {
      value: number
      date: string
      label?: string | undefined
    }[]
    key: string
    label: string
    color?: string | undefined
  },
  {
    data: {
      value: number
      date: string
      label?: string | undefined
    }[]
    key: string
    label: string
    color?: string | undefined
  }
>
export type TrendSeries = z.infer<typeof TrendSeriesSchema>
//# sourceMappingURL=analytics.d.ts.map

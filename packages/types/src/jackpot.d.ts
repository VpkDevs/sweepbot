import { z } from 'zod'
export declare const JackpotSnapshotSchema: z.ZodObject<
  {
    id: z.ZodString
    platformId: z.ZodString
    gameId: z.ZodNullable<z.ZodString>
    gameSlug: z.ZodNullable<z.ZodString>
    gameName: z.ZodNullable<z.ZodString>
    platformName: z.ZodNullable<z.ZodString>
    value: z.ZodNumber
    capturedAt: z.ZodString
  },
  'strip',
  z.ZodTypeAny,
  {
    value: number
    id: string
    platformId: string
    gameId: string | null
    platformName: string | null
    gameName: string | null
    gameSlug: string | null
    capturedAt: string
  },
  {
    value: number
    id: string
    platformId: string
    gameId: string | null
    platformName: string | null
    gameName: string | null
    gameSlug: string | null
    capturedAt: string
  }
>
export type JackpotSnapshot = z.infer<typeof JackpotSnapshotSchema>
export declare const JackpotLeaderboardEntrySchema: z.ZodObject<
  {
    platformId: z.ZodString
    platformName: z.ZodString
    platformSlug: z.ZodString
    gameId: z.ZodNullable<z.ZodString>
    gameName: z.ZodNullable<z.ZodString>
    currentValue: z.ZodNumber
    valueYesterday: z.ZodNullable<z.ZodNumber>
    deltaDay: z.ZodNullable<z.ZodNumber>
    deltaDayPct: z.ZodNullable<z.ZodNumber>
    allTimeHigh: z.ZodNullable<z.ZodNumber>
    lastUpdated: z.ZodString
  },
  'strip',
  z.ZodTypeAny,
  {
    platformId: string
    gameId: string | null
    platformName: string
    gameName: string | null
    platformSlug: string
    currentValue: number
    valueYesterday: number | null
    deltaDay: number | null
    deltaDayPct: number | null
    allTimeHigh: number | null
    lastUpdated: string
  },
  {
    platformId: string
    gameId: string | null
    platformName: string
    gameName: string | null
    platformSlug: string
    currentValue: number
    valueYesterday: number | null
    deltaDay: number | null
    deltaDayPct: number | null
    allTimeHigh: number | null
    lastUpdated: string
  }
>
export type JackpotLeaderboardEntry = z.infer<typeof JackpotLeaderboardEntrySchema>
export interface JackpotUpdateMessage {
  type: 'jackpot:update'
  platformId: string
  gameId: string | null
  gameSlug: string | null
  value: number
  previousValue: number | null
  delta: number | null
  timestamp: string
}
//# sourceMappingURL=jackpot.d.ts.map

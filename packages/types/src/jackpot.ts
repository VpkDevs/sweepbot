import { z } from 'zod'

export const JackpotSnapshotSchema = z.object({
  id: z.string().uuid(),
  platformId: z.string().uuid(),
  gameId: z.string().uuid().nullable(),
  gameSlug: z.string().nullable(),
  gameName: z.string().nullable(),
  platformName: z.string().nullable(),
  value: z.number().min(0),
  capturedAt: z.string().datetime(),
})

export type JackpotSnapshot = z.infer<typeof JackpotSnapshotSchema>

export const JackpotLeaderboardEntrySchema = z.object({
  platformId: z.string().uuid(),
  platformName: z.string(),
  platformSlug: z.string(),
  gameId: z.string().uuid().nullable(),
  gameName: z.string().nullable(),
  currentValue: z.number(),
  valueYesterday: z.number().nullable(),
  deltaDay: z.number().nullable(),
  deltaDayPct: z.number().nullable(),
  allTimeHigh: z.number().nullable(),
  lastUpdated: z.string().datetime(),
})

export type JackpotLeaderboardEntry = z.infer<typeof JackpotLeaderboardEntrySchema>

// WebSocket message types
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

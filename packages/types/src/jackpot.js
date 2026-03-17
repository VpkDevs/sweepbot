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
//# sourceMappingURL=jackpot.js.map

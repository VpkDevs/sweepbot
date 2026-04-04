import { z } from 'zod'
// ─────────────────────────────────────────────────────────────────────────────
// SESSION
// ─────────────────────────────────────────────────────────────────────────────
export const SessionStatus = z.enum(['active', 'completed', 'abandoned'])
export const SessionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  platformId: z.string().uuid(),
  gameId: z.string().uuid().nullable(),
  status: SessionStatus,
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().nullable(),
  durationSeconds: z.number().int().nullable(),
  openingBalance: z.number().nullable(),
  closingBalance: z.number().nullable(),
  totalWagered: z.number().min(0),
  totalWon: z.number().min(0),
  netResult: z.number(),
  rtp: z.number().nullable(), // e.g. 0.9650 = 96.50%
  spinCount: z.number().int().min(0),
  bonusTriggers: z.number().int().min(0),
  largestWin: z.number().min(0).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export const CreateSessionSchema = z.object({
  platformId: z.string().uuid(),
  gameId: z.string().uuid().optional(),
  openingBalance: z.number().optional(),
  startedAt: z.string().datetime().optional(),
})
export const UpdateSessionSchema = z.object({
  status: SessionStatus.optional(),
  endedAt: z.string().datetime().optional(),
  closingBalance: z.number().optional(),
  totalWagered: z.number().min(0).optional(),
  totalWon: z.number().min(0).optional(),
  spinCount: z.number().int().min(0).optional(),
  bonusTriggers: z.number().int().min(0).optional(),
  largestWin: z.number().min(0).optional(),
})
// ─────────────────────────────────────────────────────────────────────────────
// TRANSACTION
// ─────────────────────────────────────────────────────────────────────────────
export const TransactionSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  userId: z.string().uuid(),
  platformId: z.string().uuid(),
  gameId: z.string().uuid().nullable(),
  occurredAt: z.string().datetime(),
  betAmount: z.number().min(0),
  winAmount: z.number().min(0),
  balanceAfter: z.number().nullable(),
  isBonusSpin: z.boolean(),
  isBonusTrigger: z.boolean(),
  isJackpot: z.boolean(),
})
export const BatchTransactionsSchema = z.object({
  sessionId: z.string().uuid(),
  transactions: z
    .array(
      z.object({
        occurredAt: z.string().datetime(),
        betAmount: z.number().min(0),
        winAmount: z.number().min(0),
        balanceAfter: z.number().optional(),
        isBonusSpin: z.boolean().optional(),
        isBonusTrigger: z.boolean().optional(),
        isJackpot: z.boolean().optional(),
      })
    )
    .min(1)
    .max(500),
})
/** Determine confidence based on spin count */
export function getRTPConfidenceLevel(spinCount) {
  if (spinCount < 100) return 'low'
  if (spinCount < 500) return 'medium'
  return 'high'
}
/** Calculate RTP snapshot from raw totals */
export function calculateRTP(totalWagered, totalWon, spinCount) {
  const rtp = totalWagered > 0 ? totalWon / totalWagered : 0
  return {
    totalWagered,
    totalWon,
    rtp,
    rtpPercent: Math.round(rtp * 10000) / 100,
    spinCount,
    netResult: totalWon - totalWagered,
    confidenceLevel: getRTPConfidenceLevel(spinCount),
  }
}
//# sourceMappingURL=session.js.map

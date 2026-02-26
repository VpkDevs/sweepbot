import { z } from 'zod'

// ─────────────────────────────────────────────────────────────────────────────
// SESSION
// ─────────────────────────────────────────────────────────────────────────────

export const SessionStatus = z.enum(['active', 'completed', 'abandoned'])
export type SessionStatus = z.infer<typeof SessionStatus>

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
  rtp: z.number().nullable(),   // e.g. 0.9650 = 96.50%
  spinCount: z.number().int().min(0),
  bonusTriggers: z.number().int().min(0),
  largestWin: z.number().min(0).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type Session = z.infer<typeof SessionSchema>

export const CreateSessionSchema = z.object({
  platformId: z.string().uuid(),
  gameId: z.string().uuid().optional(),
  openingBalance: z.number().optional(),
  startedAt: z.string().datetime().optional(),
})

export type CreateSessionInput = z.infer<typeof CreateSessionSchema>

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

export type UpdateSessionInput = z.infer<typeof UpdateSessionSchema>

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

export type Transaction = z.infer<typeof TransactionSchema>

export const BatchTransactionsSchema = z.object({
  sessionId: z.string().uuid(),
  transactions: z.array(
    z.object({
      occurredAt: z.string().datetime(),
      betAmount: z.number().min(0),
      winAmount: z.number().min(0),
      balanceAfter: z.number().optional(),
      isBonusSpin: z.boolean().optional(),
      isBonusTrigger: z.boolean().optional(),
      isJackpot: z.boolean().optional(),
    })
  ).min(1).max(500),
})

export type BatchTransactionsInput = z.infer<typeof BatchTransactionsSchema>

// ─────────────────────────────────────────────────────────────────────────────
// RTP CALCULATION (used by extension in real time)
// ─────────────────────────────────────────────────────────────────────────────

export interface RTPSnapshot {
  totalWagered: number
  totalWon: number
  rtp: number           // 0–1 decimal (e.g. 0.965)
  rtpPercent: number    // Human-readable (e.g. 96.5)
  spinCount: number
  netResult: number
  confidenceLevel: 'low' | 'medium' | 'high'  // Based on spin count
}

/** Determine confidence based on spin count */
export function getRTPConfidenceLevel(spinCount: number): RTPSnapshot['confidenceLevel'] {
  if (spinCount < 100) return 'low'
  if (spinCount < 500) return 'medium'
  return 'high'
}

/** Calculate RTP snapshot from raw totals */
export function calculateRTP(totalWagered: number, totalWon: number, spinCount: number): RTPSnapshot {
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

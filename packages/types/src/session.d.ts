import { z } from 'zod'
export declare const SessionStatus: z.ZodEnum<['active', 'completed', 'abandoned']>
export type SessionStatus = z.infer<typeof SessionStatus>
export declare const SessionSchema: z.ZodObject<
  {
    id: z.ZodString
    userId: z.ZodString
    platformId: z.ZodString
    gameId: z.ZodNullable<z.ZodString>
    status: z.ZodEnum<['active', 'completed', 'abandoned']>
    startedAt: z.ZodString
    endedAt: z.ZodNullable<z.ZodString>
    durationSeconds: z.ZodNullable<z.ZodNumber>
    openingBalance: z.ZodNullable<z.ZodNumber>
    closingBalance: z.ZodNullable<z.ZodNumber>
    totalWagered: z.ZodNumber
    totalWon: z.ZodNumber
    netResult: z.ZodNumber
    rtp: z.ZodNullable<z.ZodNumber>
    spinCount: z.ZodNumber
    bonusTriggers: z.ZodNumber
    largestWin: z.ZodNullable<z.ZodNumber>
    createdAt: z.ZodString
    updatedAt: z.ZodString
  },
  'strip',
  z.ZodTypeAny,
  {
    status: 'active' | 'completed' | 'abandoned'
    id: string
    platformId: string
    startedAt: string
    endedAt: string | null
    totalWagered: number
    totalWon: number
    gameId: string | null
    userId: string
    createdAt: string
    updatedAt: string
    durationSeconds: number | null
    openingBalance: number | null
    closingBalance: number | null
    netResult: number
    rtp: number | null
    spinCount: number
    bonusTriggers: number
    largestWin: number | null
  },
  {
    status: 'active' | 'completed' | 'abandoned'
    id: string
    platformId: string
    startedAt: string
    endedAt: string | null
    totalWagered: number
    totalWon: number
    gameId: string | null
    userId: string
    createdAt: string
    updatedAt: string
    durationSeconds: number | null
    openingBalance: number | null
    closingBalance: number | null
    netResult: number
    rtp: number | null
    spinCount: number
    bonusTriggers: number
    largestWin: number | null
  }
>
export type Session = z.infer<typeof SessionSchema>
export declare const CreateSessionSchema: z.ZodObject<
  {
    platformId: z.ZodString
    gameId: z.ZodOptional<z.ZodString>
    openingBalance: z.ZodOptional<z.ZodNumber>
    startedAt: z.ZodOptional<z.ZodString>
  },
  'strip',
  z.ZodTypeAny,
  {
    platformId: string
    startedAt?: string | undefined
    gameId?: string | undefined
    openingBalance?: number | undefined
  },
  {
    platformId: string
    startedAt?: string | undefined
    gameId?: string | undefined
    openingBalance?: number | undefined
  }
>
export type CreateSessionInput = z.infer<typeof CreateSessionSchema>
export declare const UpdateSessionSchema: z.ZodObject<
  {
    status: z.ZodOptional<z.ZodEnum<['active', 'completed', 'abandoned']>>
    endedAt: z.ZodOptional<z.ZodString>
    closingBalance: z.ZodOptional<z.ZodNumber>
    totalWagered: z.ZodOptional<z.ZodNumber>
    totalWon: z.ZodOptional<z.ZodNumber>
    spinCount: z.ZodOptional<z.ZodNumber>
    bonusTriggers: z.ZodOptional<z.ZodNumber>
    largestWin: z.ZodOptional<z.ZodNumber>
  },
  'strip',
  z.ZodTypeAny,
  {
    status?: 'active' | 'completed' | 'abandoned' | undefined
    endedAt?: string | undefined
    totalWagered?: number | undefined
    totalWon?: number | undefined
    closingBalance?: number | undefined
    spinCount?: number | undefined
    bonusTriggers?: number | undefined
    largestWin?: number | undefined
  },
  {
    status?: 'active' | 'completed' | 'abandoned' | undefined
    endedAt?: string | undefined
    totalWagered?: number | undefined
    totalWon?: number | undefined
    closingBalance?: number | undefined
    spinCount?: number | undefined
    bonusTriggers?: number | undefined
    largestWin?: number | undefined
  }
>
export type UpdateSessionInput = z.infer<typeof UpdateSessionSchema>
export declare const TransactionSchema: z.ZodObject<
  {
    id: z.ZodString
    sessionId: z.ZodString
    userId: z.ZodString
    platformId: z.ZodString
    gameId: z.ZodNullable<z.ZodString>
    occurredAt: z.ZodString
    betAmount: z.ZodNumber
    winAmount: z.ZodNumber
    balanceAfter: z.ZodNullable<z.ZodNumber>
    isBonusSpin: z.ZodBoolean
    isBonusTrigger: z.ZodBoolean
    isJackpot: z.ZodBoolean
  },
  'strip',
  z.ZodTypeAny,
  {
    id: string
    platformId: string
    gameId: string | null
    sessionId: string
    balanceAfter: number | null
    occurredAt: string
    userId: string
    betAmount: number
    winAmount: number
    isBonusSpin: boolean
    isBonusTrigger: boolean
    isJackpot: boolean
  },
  {
    id: string
    platformId: string
    gameId: string | null
    sessionId: string
    balanceAfter: number | null
    occurredAt: string
    userId: string
    betAmount: number
    winAmount: number
    isBonusSpin: boolean
    isBonusTrigger: boolean
    isJackpot: boolean
  }
>
export type Transaction = z.infer<typeof TransactionSchema>
export declare const BatchTransactionsSchema: z.ZodObject<
  {
    sessionId: z.ZodString
    transactions: z.ZodArray<
      z.ZodObject<
        {
          occurredAt: z.ZodString
          betAmount: z.ZodNumber
          winAmount: z.ZodNumber
          balanceAfter: z.ZodOptional<z.ZodNumber>
          isBonusSpin: z.ZodOptional<z.ZodBoolean>
          isBonusTrigger: z.ZodOptional<z.ZodBoolean>
          isJackpot: z.ZodOptional<z.ZodBoolean>
        },
        'strip',
        z.ZodTypeAny,
        {
          occurredAt: string
          betAmount: number
          winAmount: number
          balanceAfter?: number | undefined
          isBonusSpin?: boolean | undefined
          isBonusTrigger?: boolean | undefined
          isJackpot?: boolean | undefined
        },
        {
          occurredAt: string
          betAmount: number
          winAmount: number
          balanceAfter?: number | undefined
          isBonusSpin?: boolean | undefined
          isBonusTrigger?: boolean | undefined
          isJackpot?: boolean | undefined
        }
      >,
      'many'
    >
  },
  'strip',
  z.ZodTypeAny,
  {
    sessionId: string
    transactions: {
      occurredAt: string
      betAmount: number
      winAmount: number
      balanceAfter?: number | undefined
      isBonusSpin?: boolean | undefined
      isBonusTrigger?: boolean | undefined
      isJackpot?: boolean | undefined
    }[]
  },
  {
    sessionId: string
    transactions: {
      occurredAt: string
      betAmount: number
      winAmount: number
      balanceAfter?: number | undefined
      isBonusSpin?: boolean | undefined
      isBonusTrigger?: boolean | undefined
      isJackpot?: boolean | undefined
    }[]
  }
>
export type BatchTransactionsInput = z.infer<typeof BatchTransactionsSchema>
export interface RTPSnapshot {
  totalWagered: number
  totalWon: number
  rtp: number
  rtpPercent: number
  spinCount: number
  netResult: number
  confidenceLevel: 'low' | 'medium' | 'high'
}
/** Determine confidence based on spin count */
export declare function getRTPConfidenceLevel(spinCount: number): RTPSnapshot['confidenceLevel']
/** Calculate RTP snapshot from raw totals */
export declare function calculateRTP(
  totalWagered: number,
  totalWon: number,
  spinCount: number
): RTPSnapshot
//# sourceMappingURL=session.d.ts.map

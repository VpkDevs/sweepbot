import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { db } from '../db/client.js'
import { sessions, transactions, platforms } from '../db/schema/comprehensive.js'
import { eq, and, desc } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth.js'

const CreateSessionSchema = z.object({
  platform_slug: z.string(),
  game_id: z.string().optional(),
  started_at: z.string().datetime()
})

const TransactionSchema = z.object({
  game_id: z.string(),
  bet_amount: z.number().positive(),
  win_amount: z.number().min(0),
  result: z.enum(['win', 'loss', 'bonus']),
  timestamp: z.string().datetime(),
  bonus_triggered: z.boolean().optional(),
  jackpot_hit: z.boolean().optional()
})

const BatchTransactionsSchema = z.object({
  session_id: z.string().uuid(),
  transactions: z.array(TransactionSchema)
})

const UpdateBalanceSchema = z.object({
  sc_balance: z.number().min(0),
  gc_balance: z.number().min(0)
})

export const sessionRoutes: FastifyPluginAsync = async (fastify) => {
  // Require auth for all session routes
  fastify.addHook('preValidation', requireAuth)

  // Create new session
  fastify.post('/', {
    schema: {
      body: CreateSessionSchema,
    }
  }, async (request, reply) => {
    const { platform_slug, game_id, started_at } = request.body as z.infer<typeof CreateSessionSchema>
    const userId = request.user!.id

    // Get platform ID
    const [platform] = await db
      .select()
      .from(platforms)
      .where(eq(platforms.slug, platform_slug))
      .limit(1)

    if (!platform) {
      return reply.code(400).send({ success: false, error: { code: 'INVALID_PLATFORM', message: 'Platform not found' } })
    }

    // Create session
    const inserted = await db.insert(sessions).values({
      userId,
      platformId: platform.id,
      gameId: game_id ?? null,
      startedAt: new Date(started_at),
      status: 'active'
    }).returning()

    const session = inserted[0]
    if (!session) {
      return reply.code(500).send({ success: false, error: { code: 'INSERT_FAILED', message: 'Failed to create session' } })
    }

    return {
      success: true,
      data: {
        sessionId: session.id,
        message: 'Session created successfully'
      }
    }
  })

  // Record single transaction
  fastify.post('/:sessionId/transactions', {
    schema: {
      params: z.object({ sessionId: z.string().uuid() }),
      body: TransactionSchema
    }
  }, async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string }
    const transaction = request.body as z.infer<typeof TransactionSchema>
    const userId = request.user?.id
    if (!userId) return reply.code(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } })

    // Verify session ownership
    const [session] = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
      .limit(1)

    if (!session) {
      return reply.code(404).send({ success: false, error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' } })
    }

    // Insert transaction
    await db.insert(transactions).values({
      sessionId,
      userId,
      platformId: session.platformId,
      gameId: transaction.game_id,
      betAmount: String(transaction.bet_amount),
      winAmount: String(transaction.win_amount),
      result: transaction.result,
      timestamp: new Date(transaction.timestamp),
      bonusTriggered: transaction.bonus_triggered ?? false,
      jackpotHit: transaction.jackpot_hit ?? false
    })

    // Update session stats
    await updateSessionStats(sessionId)

    return { success: true, data: { message: 'Transaction recorded' } }
  })

  // Batch insert transactions (more efficient)
  fastify.post('/transactions/batch', {
    schema: { body: BatchTransactionsSchema }
  }, async (request, reply) => {
    const { session_id, transactions: txs } = request.body as z.infer<typeof BatchTransactionsSchema>
    const userId = request.user?.id
    if (!userId) return reply.code(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } })

    const [session] = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.id, session_id), eq(sessions.userId, userId)))
      .limit(1)

    if (!session) {
      return reply.code(404).send({ success: false, error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' } })
    }

    // Batch insert
    if (txs.length > 0) {
      await db.insert(transactions).values(
        txs.map(tx => ({
          sessionId: session_id,
          userId,
          platformId: session.platformId,
          gameId: tx.game_id,
          betAmount: String(tx.bet_amount),
          winAmount: String(tx.win_amount),
          result: tx.result,
          timestamp: new Date(tx.timestamp),
          bonusTriggered: tx.bonus_triggered ?? false,
          jackpotHit: tx.jackpot_hit ?? false
        }))
      )

      await updateSessionStats(session_id)
    }

    return { success: true, data: { message: `${txs.length} transactions recorded` } }
  })

  // Update session balance
  fastify.patch('/:sessionId/balance', {
    schema: {
      params: z.object({ sessionId: z.string().uuid() }),
      body: UpdateBalanceSchema
    }
  }, async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string }
    const { sc_balance, gc_balance } = request.body as z.infer<typeof UpdateBalanceSchema>
    const userId = request.user?.id
    if (!userId) return reply.code(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } })

    await db.update(sessions)
      .set({
        scBalanceCurrent: String(sc_balance),
        gcBalanceCurrent: String(gc_balance),
        lastActivityAt: new Date()
      })
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))

    return { success: true, data: { message: 'Balance updated' } }
  })

  // End session
  fastify.patch('/:sessionId/end', {
    schema: {
      params: z.object({ sessionId: z.string().uuid() }),
      body: z.object({ ended_at: z.string().datetime() })
    }
  }, async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string }
    const { ended_at } = request.body as { ended_at: string }
    const userId = request.user?.id
    if (!userId) return reply.code(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } })

    // Calculate final stats
    const stats = await calculateSessionStats(sessionId)

    await db.update(sessions)
      .set({
        endedAt: new Date(ended_at),
        status: 'completed',
        totalWagered: String(stats.totalWagered),
        totalWon: String(stats.totalWon),
        netResult: String(stats.netResult),
        rtp: String(stats.rtp),
        spinCount: stats.spinCount
      })
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))

    return {
      success: true,
      data: {
        rtp: stats.rtp,
        netResult: stats.netResult
      }
    }
  })

  // Get session details
  fastify.get('/:sessionId', {
    schema: {
      params: z.object({ sessionId: z.string().uuid() })
    }
  }, async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string }
    const userId = request.user?.id
    if (!userId) return reply.code(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } })

    const [session] = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
      .limit(1)

    if (!session) {
      return reply.code(404).send({ success: false, error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' } })
    }

    // Fetch transactions separately
    const sessionTransactions = await db
      .select()
      .from(transactions)
      .where(eq(transactions.sessionId, sessionId))
      .orderBy(desc(transactions.timestamp))
      .limit(100)

    return { success: true, data: { ...session, transactions: sessionTransactions } }
  })
}

// Helper functions
async function updateSessionStats(sessionId: string) {
  const stats = await calculateSessionStats(sessionId)

  await db.update(sessions)
    .set({
      totalWagered: String(stats.totalWagered),
      totalWon: String(stats.totalWon),
      netResult: String(stats.netResult),
      rtp: String(stats.rtp),
      spinCount: stats.spinCount,
      lastActivityAt: new Date()
    })
    .where(eq(sessions.id, sessionId))
}

async function calculateSessionStats(sessionId: string) {
  const txs = await db
    .select()
    .from(transactions)
    .where(eq(transactions.sessionId, sessionId))

  const totalWagered = txs.reduce((sum: number, tx: { betAmount: string | null }) => sum + Number(tx.betAmount ?? 0), 0)
  const totalWon = txs.reduce((sum: number, tx: { winAmount: string | null }) => sum + Number(tx.winAmount ?? 0), 0)
  const netResult = totalWon - totalWagered
  const rtp = totalWagered > 0 ? (totalWon / totalWagered) * 100 : 0

  return {
    totalWagered,
    totalWon,
    netResult,
    rtp,
    spinCount: txs.length
  }
}

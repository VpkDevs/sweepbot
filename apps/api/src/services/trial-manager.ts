/**
 * Trial Manager Service
 * Manages 14-day Pro trial lifecycle: start, status, expiration.
 */

import { sql } from 'drizzle-orm'
import { query } from '../db/client.js'
import { sendTrialStartEmail } from './email.service.js'
import { logger } from '../utils/logger.js'

export interface TrialStatus {
  isActive: boolean
  daysRemaining: number
  trialEndsAt: Date | null
  tier: string
  converted: boolean
}

export class TrialManagerService {
  /**
   * Starts a 14-day Pro trial for a user.
   * Sets subscription to trialing/pro, logs the event, sends a welcome email.
   */
  async startTrial(
    userId: string,
    email: string,
    displayName?: string,
  ): Promise<{ trialEndsAt: Date }> {
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

    // Check if user has already used a trial
    const alreadyUsed = await this.hasUsedTrial(userId)
    if (alreadyUsed) {
      throw new Error('TRIAL_ALREADY_USED')
    }

    // Update (or insert) subscription row to trialing/pro
    await query(sql`
      UPDATE subscriptions
      SET
        tier = 'pro',
        status = 'trialing',
        trial_ends_at = ${trialEndsAt},
        updated_at = NOW()
      WHERE user_id = ${userId}
    `)

    // Log trial_started event
    await query(sql`
      INSERT INTO trial_events (user_id, event_type, metadata)
      VALUES (
        ${userId},
        'trial_started',
        ${sql.raw(`'${JSON.stringify({ plan: 'pro', trialEndsAt: trialEndsAt.toISOString() })}'::jsonb`)}
      )
    `)

    // Send welcome email (non-fatal if it fails)
    try {
      await sendTrialStartEmail(email, trialEndsAt, displayName)
    } catch (err) {
      logger.warn({ err, userId }, 'Failed to send trial start email')
    }

    return { trialEndsAt }
  }

  /**
   * Returns current trial status for a user, or null if no subscription exists.
   */
  async getTrialStatus(userId: string): Promise<TrialStatus | null> {
    const { rows } = await query<{
      status: string
      tier: string
      trial_ends_at: string | null
      trial_converted: boolean
    }>(sql`
      SELECT status, tier, trial_ends_at, trial_converted
      FROM subscriptions
      WHERE user_id = ${userId}
    `)

    if (!rows.length || !rows[0]) return null

    const sub = rows[0]
    const now = new Date()
    const trialEndsAt = sub.trial_ends_at ? new Date(sub.trial_ends_at) : null
    const isActive = sub.status === 'trialing' && trialEndsAt !== null && trialEndsAt > now
    const daysRemaining = trialEndsAt
      ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
      : 0

    return {
      isActive,
      daysRemaining,
      trialEndsAt,
      tier: sub.tier,
      converted: sub.trial_converted,
    }
  }

  /**
   * Batch-expires all trials that have passed their trial_ends_at date.
   * Uses a single CTE to update subscriptions and log events atomically.
   * Returns the count of expired trials.
   */
  async expireTrials(): Promise<number> {
    const { rows } = await query<{ count: number }>(sql`
      WITH expired AS (
        UPDATE subscriptions
        SET status = 'active', tier = 'free', updated_at = NOW()
        WHERE status = 'trialing' AND trial_ends_at < NOW()
        RETURNING user_id
      ),
      log_events AS (
        INSERT INTO trial_events (user_id, event_type, metadata)
        SELECT
          user_id,
          'trial_expired',
          '{"source":"batch_expire"}'::jsonb
        FROM expired
      )
      SELECT COUNT(*)::int AS count FROM expired
    `)

    const count = rows[0]?.count ?? 0
    if (count > 0) {
      logger.info({ count }, 'Expired trials processed')
    }
    return count
  }

  /**
   * Returns true if the user has ever started a trial (prevents double trials).
   */
  async hasUsedTrial(userId: string): Promise<boolean> {
    const { rows } = await query<{ count: number }>(sql`
      SELECT COUNT(*)::int AS count
      FROM trial_events
      WHERE user_id = ${userId} AND event_type = 'trial_started'
    `)
    return (rows[0]?.count ?? 0) > 0
  }
}

export const trialManager = new TrialManagerService()

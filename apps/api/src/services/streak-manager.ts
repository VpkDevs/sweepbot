/**
 * Streak Manager Service
 * Manages daily activity streaks, milestones, and leaderboard.
 */

import { sql } from 'drizzle-orm'
import { query } from '../db/client.js'
import { createNotification } from '../routes/notifications.js'
import { logger } from '../utils/logger.js'

export interface UserStreak {
  id: string
  user_id: string
  current_streak: number
  longest_streak: number
  last_activity_date: string | null
  freeze_credits: number
  created_at: string
  updated_at: string
}

export interface LeaderboardEntry {
  user_id: string
  current_streak: number
  longest_streak: number
  display_name: string | null
}

/** Streak milestones and the number of freeze credits each one awards. */
const MILESTONES: ReadonlyArray<{ days: number; freezeCredits: number }> = [
  { days: 7, freezeCredits: 1 },
  { days: 30, freezeCredits: 0 },
  { days: 100, freezeCredits: 0 },
  { days: 365, freezeCredits: 0 },
]

export class StreakManagerService {
  /**
   * Records a daily activity for a user.
   * - No-ops if already recorded today.
   * - Increments streak if yesterday was the last activity.
   * - Uses a freeze credit if the streak would otherwise break.
   * - Checks and awards milestones.
   */
  async recordActivity(
    userId: string
  ): Promise<{ currentStreak: number; milestoneReached?: number }> {
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]!

    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]!

    const { rows } = await query<{
      current_streak: number
      longest_streak: number
      last_activity_date: string | null
      freeze_credits: number
    }>(sql`
      SELECT current_streak, longest_streak, last_activity_date, freeze_credits
      FROM user_streaks
      WHERE user_id = ${userId}
    `)

    // First-ever activity
    if (!rows.length || !rows[0]) {
      await query(sql`
        INSERT INTO user_streaks (user_id, current_streak, longest_streak, last_activity_date)
        VALUES (${userId}, 1, 1, ${todayStr})
      `)
      return { currentStreak: 1 }
    }

    const streak = rows[0]

    // Already counted today
    if (streak.last_activity_date === todayStr) {
      return { currentStreak: streak.current_streak }
    }

    const isConsecutive = streak.last_activity_date === yesterdayStr
    const usedFreeze = !isConsecutive && streak.freeze_credits > 0

    let newStreak: number
    if (isConsecutive) {
      newStreak = streak.current_streak + 1
    } else if (usedFreeze) {
      newStreak = streak.current_streak // shield: keep streak, just update date
    } else {
      newStreak = 1
    }

    const newLongest = Math.max(streak.longest_streak, newStreak)

    await query(sql`
      UPDATE user_streaks
      SET
        current_streak = ${newStreak},
        longest_streak = ${newLongest},
        last_activity_date = ${todayStr},
        freeze_credits = GREATEST(0, freeze_credits - ${usedFreeze ? 1 : 0}),
        updated_at = NOW()
      WHERE user_id = ${userId}
    `)

    // Check milestone thresholds
    let milestoneReached: number | undefined
    for (const { days, freezeCredits } of MILESTONES) {
      if (newStreak >= days) {
        const { rows: inserted } = await query<{ id: string }>(sql`
          INSERT INTO streak_milestones (user_id, milestone)
          VALUES (${userId}, ${days})
          ON CONFLICT (user_id, milestone) DO NOTHING
          RETURNING id
        `)

        if (inserted.length > 0) {
          milestoneReached = days

          if (freezeCredits > 0) {
            await query(sql`
              UPDATE user_streaks
              SET freeze_credits = freeze_credits + ${freezeCredits}
              WHERE user_id = ${userId}
            `)
          }

          createNotification({
            userId,
            type: 'milestone',
            title: `🔥 ${days}-Day Streak!`,
            body: `You've maintained a ${days}-day activity streak. Keep it up!`,
            data: { milestone: days, streak: newStreak },
          }).catch((err: unknown) =>
            logger.warn({ err, userId, days }, 'Failed to create streak notification')
          )
        }
      }
    }

    return milestoneReached !== undefined
      ? { currentStreak: newStreak, milestoneReached }
      : { currentStreak: newStreak }
  }

  /**
   * Returns the streak record for a user, or null if none exists.
   */
  async getStreak(userId: string): Promise<UserStreak | null> {
    const { rows } = await query<UserStreak>(sql`
      SELECT id, user_id, current_streak, longest_streak, last_activity_date, freeze_credits, created_at, updated_at
      FROM user_streaks
      WHERE user_id = ${userId}
    `)
    return rows[0] ?? null
  }

  /**
   * Returns the top N users by current streak, joined with display names.
   */
  async getLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
    const safeLimit = Math.min(Math.max(1, limit), 100)
    const { rows } = await query<LeaderboardEntry>(sql`
      SELECT
        us.user_id,
        us.current_streak,
        us.longest_streak,
        p.display_name
      FROM user_streaks us
      LEFT JOIN profiles p ON p.id = us.user_id
      WHERE us.current_streak > 0
      ORDER BY us.current_streak DESC, us.longest_streak DESC
      LIMIT ${safeLimit}
    `)
    return rows
  }

  /**
   * Nightly job: protect or reset streaks for users who missed a day.
   * Users with freeze credits lose one credit (streak preserved).
   * Users without credits have their streak reset to 0.
   */
  async processNightlyCheck(): Promise<void> {
    const { rows } = await query<{ count: number }>(sql`
      WITH updated AS (
        UPDATE user_streaks
        SET
          current_streak = CASE WHEN freeze_credits > 0 THEN current_streak ELSE 0 END,
          freeze_credits = GREATEST(0, freeze_credits - 1),
          updated_at = NOW()
        WHERE
          last_activity_date < CURRENT_DATE
          AND current_streak > 0
        RETURNING user_id
      )
      SELECT COUNT(*)::int AS count FROM updated
    `)
    logger.info({ affected: rows[0]?.count ?? 0 }, 'Nightly streak check complete')
  }
}

export const streakManager = new StreakManagerService()

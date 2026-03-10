/**
 * Phase 2 Feature Tables
 * Achievements, Personal Records, Big Wins Community Board
 */

import { pgTable, uuid, varchar, text, integer, boolean, timestamp, decimal, jsonb, unique } from 'drizzle-orm/pg-core'

// ─── Achievement Catalogue ────────────────────────────────────────────────────

export const achievements = pgTable('achievements', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: varchar('key', { length: 100 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description').notNull(),
  icon: varchar('icon', { length: 100 }).notNull(),
  category: varchar('category', { length: 50 }).notNull(), // sessions | bonuses | jackpots | streaks | social | flows
  tier: varchar('tier', { length: 20 }).notNull(),         // bronze | silver | gold | platinum
  points: integer('points').notNull().default(0),
  requirement: jsonb('requirement').notNull(),               // { type: 'session_count', threshold: 100 }
  isSecret: boolean('is_secret').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const userAchievements = pgTable(
  'user_achievements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    achievementId: uuid('achievement_id').notNull().references(() => achievements.id),
    earnedAt: timestamp('earned_at').defaultNow().notNull(),
    progress: jsonb('progress'),   // { current: 47, required: 100 }
    notified: boolean('notified').notNull().default(false),
  },
  (t) => ({ uniq: unique().on(t.userId, t.achievementId) })
)

// ─── Personal Records ─────────────────────────────────────────────────────────

export const personalRecords = pgTable('personal_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique(),
  biggestSingleWin: decimal('biggest_single_win', { precision: 12, scale: 4 }),
  biggestWinDate: timestamp('biggest_win_date'),
  biggestWinGame: varchar('biggest_win_game', { length: 255 }),
  biggestWinPlatform: varchar('biggest_win_platform', { length: 255 }),
  longestWinStreak: integer('longest_win_streak').notNull().default(0),
  currentWinStreak: integer('current_win_streak').notNull().default(0),
  longestLossStreak: integer('longest_loss_streak').notNull().default(0),
  currentLossStreak: integer('current_loss_streak').notNull().default(0),
  bestRtpSession: decimal('best_rtp_session', { precision: 6, scale: 4 }),
  bestRtpMinBets: integer('best_rtp_min_bets').notNull().default(100),
  highestBalance: decimal('highest_balance', { precision: 12, scale: 4 }),
  mostBonusesSingleDay: integer('most_bonuses_single_day').notNull().default(0),
  totalJackpotsHit: integer('total_jackpots_hit').notNull().default(0),
  biggestJackpot: decimal('biggest_jackpot', { precision: 12, scale: 4 }),
  lastComputedAt: timestamp('last_computed_at').defaultNow().notNull(),
})

// ─── Community Big Wins Board ─────────────────────────────────────────────────

export const bigWins = pgTable('big_wins', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  platformId: uuid('platform_id'),
  platformName: varchar('platform_name', { length: 255 }),
  gameName: varchar('game_name', { length: 255 }),
  winAmountSc: decimal('win_amount_sc', { precision: 12, scale: 4 }).notNull(),
  multiplier: decimal('multiplier', { precision: 10, scale: 2 }),
  betAmount: decimal('bet_amount', { precision: 12, scale: 4 }),
  screenshotUrl: text('screenshot_url'),
  verificationStatus: varchar('verification_status', { length: 30 }).notNull().default('pending'),
  // pending | verified | rejected | auto_verified
  verifiedAt: timestamp('verified_at'),
  isPublic: boolean('is_public').notNull().default(true),
  displayName: varchar('display_name', { length: 100 }),
  occurredAt: timestamp('occurred_at').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

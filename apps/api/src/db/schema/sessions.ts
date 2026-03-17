/**
 * Sessions Schema
 * Gameplay session tracking with RTP calculation
 */

import { pgTable, uuid, timestamp, integer, decimal, text } from 'drizzle-orm/pg-core'
import { profiles } from './profiles'
import { platforms } from './platforms'

/**
 * Gameplay sessions - tracked by browser extension
 * Captures P&L, RTP, duration, and spin metrics
 */
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  platformId: uuid('platform_id')
    .notNull()
    .references(() => platforms.id),
  gameId: uuid('game_id'), // FK to games table (optional, may not know specific game)
  status: text('status').notNull().default('active'), // active | paused | completed
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  durationSeconds: integer('duration_seconds'),
  openingBalance: decimal('opening_balance', { precision: 12, scale: 2 }),
  closingBalance: decimal('closing_balance', { precision: 12, scale: 2 }),
  totalWagered: decimal('total_wagered', { precision: 12, scale: 2 }).notNull().default('0'),
  totalWon: decimal('total_won', { precision: 12, scale: 2 }).notNull().default('0'),

  // Computed as GENERATED column in Postgres: total_won - total_wagered
  // Drizzle doesn't support GENERATED columns yet, so we omit it here
  // and calculate in application code or via raw SQL
  // netResult: decimal('net_result', { precision: 12, scale: 2 }),

  rtp: decimal('rtp', { precision: 7, scale: 4 }), // e.g. 0.9650 = 96.50%
  spinCount: integer('spin_count').notNull().default(0),
  bonusTriggers: integer('bonus_triggers').notNull().default(0),
  largestWin: decimal('largest_win', { precision: 12, scale: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ============================================================================
// TypeScript Types
// ============================================================================

export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert

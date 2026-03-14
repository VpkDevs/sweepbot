/**
 * Trust Index Schema — SweepBot
 * Tables: trust_index_scores, trust_index_alerts, platform_ratings, platform_bonuses
 *
 * These tables power the SweepBot Trust Index scoring engine.
 * See /docs/TRUST_INDEX_METHODOLOGY.md for scoring methodology.
 */

import {
  pgTable,
  uuid,
  numeric,
  integer,
  boolean,
  varchar,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ── trust_index_scores ────────────────────────────────────────────────────────
// Computed Trust Index scores. One row per recalculation per platform.
// The latest row (by calculated_at DESC) is the canonical current score.
// History rows are retained for trend charts (90-day sparklines, etc.)

export const trustIndexScores = pgTable('trust_index_scores', {
  id: uuid('id').primaryKey().defaultRandom(),
  platformId: uuid('platform_id').notNull(),

  // Composite score (0–100)
  overallScore: numeric('overall_score', { precision: 5, scale: 2 }).notNull(),

  // Per-factor component scores (0–100 each)
  redemptionSpeedScore:          numeric('redemption_speed_score',          { precision: 5, scale: 2 }).notNull(),
  redemptionRejectionRateScore:  numeric('redemption_rejection_rate_score', { precision: 5, scale: 2 }).notNull(),
  tosStabilityScore:             numeric('tos_stability_score',             { precision: 5, scale: 2 }).notNull(),
  bonusGenerosityScore:          numeric('bonus_generosity_score',          { precision: 5, scale: 2 }).notNull(),
  communitySatisfactionScore:    numeric('community_satisfaction_score',    { precision: 5, scale: 2 }).notNull(),
  supportResponsivenessScore:    numeric('support_responsiveness_score',    { precision: 5, scale: 2 }).notNull(),
  regulatoryStandingScore:       numeric('regulatory_standing_score',       { precision: 5, scale: 2 }).notNull(),

  // Metadata
  sampleSize:   integer('sample_size').default(0),
  calculatedAt: timestamp('calculated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  platformTimeIdx: index('trust_index_scores_platform_time_idx').on(table.platformId, table.calculatedAt),
  scoreIdx:        index('trust_index_scores_score_idx').on(table.overallScore),
}))

// ── trust_index_alerts ────────────────────────────────────────────────────────
// User subscriptions to Trust Index score change notifications.
// ON CONFLICT (user_id, platform_id) → upsert pattern used in trust.ts.

export const trustIndexAlerts = pgTable('trust_index_alerts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId:     uuid('user_id').notNull(),
  platformId: uuid('platform_id').notNull(),

  // Threshold configuration
  thresholdDirection: varchar('threshold_direction', { length: 10 }).notNull().default('any'), // 'above' | 'below' | 'any'
  thresholdScore:     numeric('threshold_score', { precision: 5, scale: 2 }),

  // State
  isActive:        boolean('is_active').notNull().default(true),
  triggerCount:    integer('trigger_count').notNull().default(0),
  lastTriggeredAt: timestamp('last_triggered_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  // One alert subscription per user-platform pair
  userPlatformUnique: unique('trust_index_alerts_user_platform_unique').on(table.userId, table.platformId),
  userIdx:     index('trust_index_alerts_user_idx').on(table.userId),
  platformIdx: index('trust_index_alerts_platform_idx').on(table.platformId),
}))

// ── platform_ratings ──────────────────────────────────────────────────────────
// Community star ratings submitted by users (1–5 scale).
// Used for the community_satisfaction factor in the Trust Index.

export const platformRatings = pgTable('platform_ratings', {
  id:         uuid('id').primaryKey().defaultRandom(),
  platformId: uuid('platform_id').notNull(),
  userId:     uuid('user_id').notNull(),
  rating:     integer('rating').notNull(), // 1-5
  review:     varchar('review', { length: 1000 }),
  createdAt:  timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt:  timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  // One rating per user per platform (users can update, not duplicate)
  userPlatformUnique: unique('platform_ratings_user_platform_unique').on(table.userId, table.platformId),
  platformIdx:  index('platform_ratings_platform_idx').on(table.platformId),
  createdAtIdx: index('platform_ratings_created_at_idx').on(table.createdAt),
}))

// ── platform_bonuses ──────────────────────────────────────────────────────────
// Community-reported bonus details.
// Used for the bonus_generosity factor in the Trust Index
// (AVG(wagering_requirement / bonus_amount) → lower = more generous).

export const platformBonuses = pgTable('platform_bonuses', {
  id:                  uuid('id').primaryKey().defaultRandom(),
  platformId:          uuid('platform_id').notNull(),
  userId:              uuid('user_id').notNull(),
  bonusType:           varchar('bonus_type', { length: 50 }),      // 'welcome', 'daily', 'reload', etc.
  bonusAmount:         numeric('bonus_amount', { precision: 12, scale: 2 }).notNull(),
  wageringRequirement: numeric('wagering_requirement', { precision: 12, scale: 2 }).notNull(),
  currency:            varchar('currency', { length: 10 }).default('SC'),
  notes:               varchar('notes', { length: 500 }),
  createdAt:           timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  platformIdx:  index('platform_bonuses_platform_idx').on(table.platformId),
  createdAtIdx: index('platform_bonuses_created_at_idx').on(table.createdAt),
}))

// ── platform_community_signals ────────────────────────────────────────────────
// Community sentiment signals (positive/negative/neutral) submitted via
// POST /platforms/:id/upvote-trust. One vote per user per platform per day per category.

export const platformCommunitySignals = pgTable('platform_community_signals', {
  id:         uuid('id').primaryKey().defaultRandom(),
  platformId: uuid('platform_id').notNull(),
  userId:     uuid('user_id').notNull(),
  sentiment:  varchar('sentiment', { length: 20 }).notNull(),   // 'positive' | 'negative' | 'neutral'
  category:   varchar('category', { length: 50 }).notNull(),    // 'redemption' | 'support' | 'bonus' | 'fairness' | 'general'
  comment:    varchar('comment', { length: 500 }),
  createdAt:  timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  platformIdx:  index('platform_community_signals_platform_idx').on(table.platformId),
  userIdx:      index('platform_community_signals_user_idx').on(table.userId),
  createdAtIdx: index('platform_community_signals_created_at_idx').on(table.createdAt),
}))

// ── game_providers ────────────────────────────────────────────────────────────
// Game software providers (NetEnt, Pragmatic Play, etc.)
// Referenced by the games table via provider_id FK.

export const gameProviders = pgTable('game_providers', {
  id:        uuid('id').primaryKey().defaultRandom(),
  slug:      varchar('slug', { length: 100 }).notNull().unique(),
  name:      varchar('name', { length: 255 }).notNull(),
  logoUrl:   varchar('logo_url', { length: 500 }),
  isActive:  boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  slugIdx: index('game_providers_slug_idx').on(table.slug),
}))

// ── TypeScript types ──────────────────────────────────────────────────────────
export type TrustIndexScore         = typeof trustIndexScores.$inferSelect
export type NewTrustIndexScore      = typeof trustIndexScores.$inferInsert
export type TrustIndexAlert         = typeof trustIndexAlerts.$inferSelect
export type NewTrustIndexAlert      = typeof trustIndexAlerts.$inferInsert
export type PlatformRating          = typeof platformRatings.$inferSelect
export type NewPlatformRating       = typeof platformRatings.$inferInsert
export type PlatformBonus           = typeof platformBonuses.$inferSelect
export type NewPlatformBonus        = typeof platformBonuses.$inferInsert
export type PlatformCommunitySignal = typeof platformCommunitySignals.$inferSelect
export type NewPlatformCommunitySignal = typeof platformCommunitySignals.$inferInsert
export type GameProvider            = typeof gameProviders.$inferSelect
export type NewGameProvider         = typeof gameProviders.$inferInsert

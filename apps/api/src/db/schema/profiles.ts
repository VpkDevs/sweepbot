/**
 * User Profiles Schema
 * Core user identity and settings
 */

import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * User profiles - auto-created on Supabase auth signup
 * References auth.users(id) with CASCADE delete
 */
export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),  // FK to auth.users(id)
  email: text('email').notNull(),
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'),
  bio: text('bio'),
  tier: text('tier').notNull().default('free'),  // free | starter | pro | enterprise
  stripeCustomerId: text('stripe_customer_id'),
  timezone: text('timezone').notNull().default('America/New_York'),
  locale: text('locale').notNull().default('en-US'),
  onboardedAt: timestamp('onboarded_at', { withTimezone: true }),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * User platforms - tracks which sweepstakes casinos a user monitors
 */
export const userPlatforms = pgTable('user_platforms', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  platformId: uuid('platform_id').notNull(),  // FK to platforms table (created separately)
  isActive: text('is_active').notNull().default('true'),
  nickname: text('nickname'),
  addedAt: timestamp('added_at', { withTimezone: true }).defaultNow().notNull(),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
});

// ============================================================================
// TypeScript Types
// ============================================================================

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;

export type UserPlatform = typeof userPlatforms.$inferSelect;
export type NewUserPlatform = typeof userPlatforms.$inferInsert;

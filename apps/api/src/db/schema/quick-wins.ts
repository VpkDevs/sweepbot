/**
 * Drizzle ORM Schema: Quick Wins Features
 * Tables: user_streaks, streak_milestones, trial_events, push_subscriptions, notification_preferences, session_notes
 */

import { pgTable, uuid, text, integer, date, timestamp, jsonb, boolean, decimal, index, check, unique } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { profiles } from './profiles';
import { sessions } from './sessions';

/**
 * User Streaks - Daily activity tracking for gamification
 */
export const userStreaks = pgTable('user_streaks', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => profiles.id).unique(),
  currentStreak: integer('current_streak').notNull().default(0),
  longestStreak: integer('longest_streak').notNull().default(0),
  lastActivityDate: date('last_activity_date'),
  freezeCredits: integer('freeze_credits').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  userIdx: index('idx_user_streaks_user').on(table.userId),
  longestIdx: index('idx_user_streaks_longest').on(table.longestStreak.desc()),
  currentIdx: index('idx_user_streaks_current').on(table.currentStreak.desc()),
  currentCheck: check('user_streaks_current_check', sql`current_streak >= 0`),
  longestCheck: check('user_streaks_longest_check', sql`longest_streak >= 0`),
  freezeCheck: check('user_streaks_freeze_check', sql`freeze_credits >= 0`),
}));

/**
 * Streak Milestones - Achievement tracking for 7, 30, 100, 365 day streaks
 */
export const streakMilestones = pgTable('streak_milestones', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => profiles.id),
  milestone: integer('milestone').notNull(),
  achievedAt: timestamp('achieved_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  userMilestoneUnique: unique('streak_milestones_user_milestone_unique').on(table.userId, table.milestone),
  userIdx: index('idx_streak_milestones_user').on(table.userId, table.milestone.desc()),
  achievedIdx: index('idx_streak_milestones_achieved').on(table.achievedAt.desc()),
  milestoneCheck: check('streak_milestones_check', sql`milestone IN (7, 30, 100, 365)`),
}));

/**
 * Trial Events - Audit log for 14-day trial lifecycle
 */
export const trialEvents = pgTable('trial_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => profiles.id),
  eventType: text('event_type', {
    enum: ['trial_started', 'trial_reminder_sent', 'trial_ending_soon', 'trial_converted', 'trial_expired', 'trial_cancelled']
  }).notNull(),
  metadata: jsonb('metadata').$type<{
    plan?: string;
    trialEndsAt?: string;
    reminderDay?: number;
    conversionAmount?: number;
    cancellationReason?: string;
    [key: string]: unknown;
  }>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  userIdx: index('idx_trial_events_user').on(table.userId, table.createdAt.desc()),
  typeIdx: index('idx_trial_events_type').on(table.eventType, table.createdAt.desc()),
  createdIdx: index('idx_trial_events_created').on(table.createdAt.desc()),
}));

/**
 * Push Subscriptions - Web Push API endpoint management
 */
export const pushSubscriptions = pgTable('push_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => profiles.id),
  endpoint: text('endpoint').notNull().unique(),
  keys: jsonb('keys').notNull().$type<{
    p256dh: string;
    auth: string;
  }>(),
  userAgent: text('user_agent'),
  isActive: boolean('is_active').default(true),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }).defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  userIdx: index('idx_push_subscriptions_user').on(table.userId),
  endpointIdx: index('idx_push_subscriptions_endpoint').on(table.endpoint),
  // Partial index for active subscriptions created via raw SQL
}));

/**
 * Notification Preferences - User settings for alert types
 */
export const notificationPreferences = pgTable('notification_preferences', {
  userId: uuid('user_id').primaryKey().references(() => profiles.id),
  jackpotAlerts: boolean('jackpot_alerts').default(true),
  tosChanges: boolean('tos_changes').default(true),
  platformOutages: boolean('platform_outages').default(true),
  flowErrors: boolean('flow_errors').default(true),
  trialReminders: boolean('trial_reminders').default(true),
  dailySummary: boolean('daily_summary').default(false),
  weeklyReport: boolean('weekly_report').default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

/**
 * Session Notes - Text and voice annotations for gaming sessions
 */
export const sessionNotes = pgTable('session_notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull().references(() => sessions.id),
  userId: uuid('user_id').notNull().references(() => profiles.id),
  content: text('content').notNull(),
  noteType: text('note_type', {
    enum: ['text', 'voice', 'image']
  }).notNull().default('text'),
  audioUrl: text('audio_url'),
  audioDuration: integer('audio_duration'),
  transcriptionConfidence: decimal('transcription_confidence', { precision: 3, scale: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  sessionIdx: index('idx_session_notes_session').on(table.sessionId, table.createdAt.desc()),
  userIdx: index('idx_session_notes_user').on(table.userId, table.createdAt.desc()),
  typeIdx: index('idx_session_notes_type').on(table.noteType, table.createdAt.desc()),
  // Full-text search index created via raw SQL
}));

// Type exports
export type UserStreak = typeof userStreaks.$inferSelect;
export type NewUserStreak = typeof userStreaks.$inferInsert;

export type StreakMilestone = typeof streakMilestones.$inferSelect;
export type NewStreakMilestone = typeof streakMilestones.$inferInsert;

export type TrialEvent = typeof trialEvents.$inferSelect;
export type NewTrialEvent = typeof trialEvents.$inferInsert;

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscription = typeof pushSubscriptions.$inferInsert;

export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type NewNotificationPreference = typeof notificationPreferences.$inferInsert;

export type SessionNote = typeof sessionNotes.$inferSelect;
export type NewSessionNote = typeof sessionNotes.$inferInsert;

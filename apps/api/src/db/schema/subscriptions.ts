/**
 * Subscriptions Schema
 * Stripe billing and trial management
 */

import { pgTable, uuid, text, timestamp, boolean, index } from 'drizzle-orm/pg-core';
import { profiles } from './profiles';

/**
 * User subscriptions - managed by Stripe webhooks
 * Trial fields added via migration 006
 */
export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  stripeSubscriptionId: text('stripe_subscription_id'),
  stripePriceId: text('stripe_price_id'),
  tier: text('tier').notNull().default('free'),  // free | starter | pro | enterprise
  status: text('status').notNull().default('active'),  // active | trialing | past_due | canceled | paused
  currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
  trialEnd: timestamp('trial_end', { withTimezone: true }),
  
  // Trial management (added in migration 006)
  trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
  trialConverted: boolean('trial_converted').notNull().default(false),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdx: index('idx_subscriptions_user').on(table.userId),
  stripeIdx: index('idx_subscriptions_stripe').on(table.stripeSubscriptionId),
}));

// ============================================================================
// TypeScript Types
// ============================================================================

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;

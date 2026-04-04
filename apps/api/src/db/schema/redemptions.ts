/**
 * Redemptions Schema — SweepBot
 *
 * Tracks Sweeps Coin redemption requests submitted by users.
 * Used by:
 *   - /redemptions/* API routes (CRUD + stats)
 *   - Trust Index scoring engine (speed + rejection rate factors)
 *   - Tax summary endpoint (/user/tax-summary, /tax/summary)
 *   - Analytics (platform P&L, community benchmarks)
 *
 * NOTE: Use `completed_at` (not `received_at`) for completion timestamp.
 * The `received_at` field does not exist — this is a known gap (#13 in GAP_ANALYSIS.md).
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  timestamp,
  integer,
  boolean,
  jsonb,
  index,
} from 'drizzle-orm/pg-core'

export const redemptions = pgTable(
  'redemptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    platformId: uuid('platform_id').notNull(),

    // Amount fields
    amountSc: numeric('amount_sc', { precision: 12, scale: 4 }).notNull(), // Sweeps Coin amount
    amountUsd: numeric('amount_usd', { precision: 12, scale: 2 }), // USD equivalent at submission
    paymentMethod: varchar('payment_method', { length: 100 }), // 'paypal', 'check', 'bank_transfer', etc.

    // Status state machine: pending → processing → completed | rejected | cancelled
    status: varchar('status', { length: 30 }).notNull().default('pending'),

    // Timestamps for timing analytics (used in Trust Index redemption speed scoring)
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }), // When funds arrived
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),

    // Rejection details
    rejectionReason: text('rejection_reason'),

    // User-facing reference
    externalReferenceId: varchar('external_reference_id', { length: 255 }), // Platform's transaction ID
    notes: text('notes'),

    /** Community-visible flag — anonymised timing data shared for Trust Index */
    consentToShare: boolean('consent_to_share').notNull().default(true),

    metadata: jsonb('metadata').default('{}'),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    userIdx: index('redemptions_user_idx').on(table.userId),
    platformIdx: index('redemptions_platform_idx').on(table.platformId),
    statusIdx: index('redemptions_status_idx').on(table.status),
    submittedAtIdx: index('redemptions_submitted_at_idx').on(table.submittedAt),
    completedAtIdx: index('redemptions_completed_at_idx').on(table.completedAt),
    // Composite for Trust Index scoring queries
    platformStatusIdx: index('redemptions_platform_status_idx').on(
      table.platformId,
      table.status,
      table.submittedAt
    ),
  })
)

export type Redemption = typeof redemptions.$inferSelect
export type NewRedemption = typeof redemptions.$inferInsert

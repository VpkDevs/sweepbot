import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  decimal,
  integer,
  boolean,
  jsonb,
  index,
  primaryKey,
  date,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ── Core Tables ───────────────────────────────────────────────────────────────

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  displayName: varchar('display_name', { length: 100 }),
  avatarUrl: text('avatar_url'),
  tier: varchar('tier', { length: 20 }).default('free'),
  stripeCustomerId: varchar('stripe_customer_id', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const platforms = pgTable('platforms', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: varchar('slug', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  url: varchar('url', { length: 255 }).notNull(),
  affiliateUrl: text('affiliate_url'),
  logoUrl: text('logo_url'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
})

export const games = pgTable('games', {
  id: uuid('id').primaryKey().defaultRandom(),
  platformId: uuid('platform_id').references(() => platforms.id),
  externalGameId: varchar('external_game_id', { length: 100 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  provider: varchar('provider', { length: 100 }),
  // Optional FK to game_providers table for structured provider data
  providerId: uuid('provider_id'),
  slug: varchar('slug', { length: 100 }),
  thumbnailUrl: text('thumbnail_url'),
  theoreticalRtp: decimal('theoretical_rtp', { precision: 5, scale: 2 }),
  volatilityClass: varchar('volatility_class', { length: 20 }),
  isFeatured: boolean('is_featured').default(false),
  jackpotEligible: boolean('jackpot_eligible').default(false),
  releaseDate: date('release_date'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
})

// ── Session & Transaction Tables ──────────────────────────────────────────────

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => profiles.id)
      .notNull(),
    platformId: uuid('platform_id')
      .references(() => platforms.id)
      .notNull(),
    gameId: varchar('game_id', { length: 100 }),
    startedAt: timestamp('started_at').notNull(),
    endedAt: timestamp('ended_at'),
    status: varchar('status', { length: 20 }).default('active'),

    // Balance tracking
    scBalanceStart: decimal('sc_balance_start', { precision: 12, scale: 2 }),
    gcBalanceStart: decimal('gc_balance_start', { precision: 12, scale: 2 }),
    scBalanceCurrent: decimal('sc_balance_current', { precision: 12, scale: 2 }),
    gcBalanceCurrent: decimal('gc_balance_current', { precision: 12, scale: 2 }),

    // Session statistics
    totalWagered: decimal('total_wagered', { precision: 12, scale: 2 }).default('0'),
    totalWon: decimal('total_won', { precision: 12, scale: 2 }).default('0'),
    netResult: decimal('net_result', { precision: 12, scale: 2 }).default('0'),
    rtp: decimal('rtp', { precision: 5, scale: 2 }),
    spinCount: integer('spin_count').default(0),

    lastActivityAt: timestamp('last_activity_at'),
    // Added: duration in seconds computed at session close (gap #10)
    durationSeconds: integer('duration_seconds'),
    // Added: JSONB bag for extension metadata including client_session_id idempotency key (gap #10)
    metadata: jsonb('metadata').default('{}'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('sessions_user_id_idx').on(table.userId),
    platformIdIdx: index('sessions_platform_id_idx').on(table.platformId),
    startedAtIdx: index('sessions_started_at_idx').on(table.startedAt),
  })
)

export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .references(() => sessions.id)
      .notNull(),
    userId: uuid('user_id')
      .references(() => profiles.id)
      .notNull(),
    platformId: uuid('platform_id')
      .references(() => platforms.id)
      .notNull(),
    gameId: varchar('game_id', { length: 100 }),

    betAmount: decimal('bet_amount', { precision: 10, scale: 2 }).notNull(),
    winAmount: decimal('win_amount', { precision: 10, scale: 2 }).notNull(),
    balanceAfter: decimal('balance_after', { precision: 12, scale: 2 }),

    result: varchar('result', { length: 20 }).notNull(), // 'win', 'loss', 'bonus'
    bonusTriggered: boolean('bonus_triggered').default(false),
    jackpotHit: boolean('jackpot_hit').default(false),

    timestamp: timestamp('timestamp').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    sessionIdIdx: index('transactions_session_id_idx').on(table.sessionId),
    userIdIdx: index('transactions_user_id_idx').on(table.userId),
    timestampIdx: index('transactions_timestamp_idx').on(table.timestamp),
    gameIdIdx: index('transactions_game_id_idx').on(table.gameId),
  })
)

// ── Achievements & Gamification ───────────────────────────────────────────────

export const userStreaks = pgTable('user_streaks', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => profiles.id)
    .notNull()
    .unique(),
  currentStreak: integer('current_streak').default(0),
  longestStreak: integer('longest_streak').default(0),
  lastActivityDate: timestamp('last_activity_date'),
  freezeCredits: integer('freeze_credits').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const personalRecords = pgTable(
  'personal_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => profiles.id)
      .notNull(),
    recordType: varchar('record_type', { length: 50 }).notNull(),
    value: decimal('value', { precision: 12, scale: 2 }).notNull(),
    sessionId: uuid('session_id').references(() => sessions.id),
    platformId: uuid('platform_id').references(() => platforms.id),
    gameName: varchar('game_name', { length: 255 }),
    achievedAt: timestamp('achieved_at').defaultNow(),
    metadata: jsonb('metadata').default('{}'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    userRecordTypeIdx: index('personal_records_user_record_type_idx').on(
      table.userId,
      table.recordType
    ),
    achievedAtIdx: index('personal_records_achieved_at_idx').on(table.achievedAt),
  })
)

// ── Notifications ─────────────────────────────────────────────────────────────

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => profiles.id)
      .notNull(),
    type: varchar('type', { length: 50 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    message: text('message').notNull(),
    data: jsonb('data').default('{}'),
    isRead: boolean('is_read').default(false),
    readAt: timestamp('read_at'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('notifications_user_id_idx').on(table.userId),
    isReadIdx: index('notifications_is_read_idx').on(table.isRead),
    createdAtIdx: index('notifications_created_at_idx').on(table.createdAt),
  })
)

// ── Intelligence & Analytics ──────────────────────────────────────────────────

export const gameIntelligence = pgTable(
  'game_intelligence',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gameId: varchar('game_id', { length: 100 }).notNull(),
    platformId: uuid('platform_id')
      .references(() => platforms.id)
      .notNull(),

    // Community aggregated stats
    totalSpins: integer('total_spins').default(0),
    totalWagered: decimal('total_wagered', { precision: 15, scale: 2 }).default('0'),
    totalWon: decimal('total_won', { precision: 15, scale: 2 }).default('0'),
    communityRtp: decimal('community_rtp', { precision: 5, scale: 2 }),

    // Bonus analysis
    bonusFrequency: decimal('bonus_frequency', { precision: 5, scale: 2 }),
    avgBonusPayout: decimal('avg_bonus_payout', { precision: 10, scale: 2 }),
    maxWin: decimal('max_win', { precision: 12, scale: 2 }),

    // Volatility metrics
    volatilityScore: decimal('volatility_score', { precision: 5, scale: 2 }),
    winRate: decimal('win_rate', { precision: 5, scale: 2 }),

    uniquePlayers: integer('unique_players').default(0),
    lastUpdated: timestamp('last_updated').defaultNow(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    gameIdIdx: index('game_intelligence_game_id_idx').on(table.gameId),
    platformIdIdx: index('game_intelligence_platform_id_idx').on(table.platformId),
    communityRtpIdx: index('game_intelligence_community_rtp_idx').on(table.communityRtp),
  })
)

export const jackpotSnapshots = pgTable(
  'jackpot_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    platformId: uuid('platform_id')
      .references(() => platforms.id)
      .notNull(),
    gameId: varchar('game_id', { length: 100 }).notNull(),
    // jackpotName: e.g. 'Mega', 'Major' for games with multiple pools (gap #9)
    jackpotName: varchar('jackpot_name', { length: 100 }),
    // amount: renamed from 'value' to match query usage in jackpots.ts (gap #9)
    amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 10 }).default('SC'),
    // Hit tracking fields (gap #9)
    lastHitAt: timestamp('last_hit_at'),
    lastHitAmount: decimal('last_hit_amount', { precision: 12, scale: 2 }),
    capturedAt: timestamp('captured_at').defaultNow(),
  },
  (table) => ({
    gameIdIdx: index('jackpot_snapshots_game_id_idx').on(table.gameId),
    capturedAtIdx: index('jackpot_snapshots_captured_at_idx').on(table.capturedAt),
    platformGameIdx: index('jackpot_snapshots_platform_game_idx').on(
      table.platformId,
      table.gameId
    ),
  })
)

// ── Relations ─────────────────────────────────────────────────────────────────

export const profilesRelations = relations(profiles, ({ many }) => ({
  sessions: many(sessions),
  transactions: many(transactions),
  notifications: many(notifications),
  personalRecords: many(personalRecords),
  userStreaks: many(userStreaks),
}))

export const platformsRelations = relations(platforms, ({ many }) => ({
  sessions: many(sessions),
  games: many(games),
  jackpotSnapshots: many(jackpotSnapshots),
}))

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  user: one(profiles, {
    fields: [sessions.userId],
    references: [profiles.id],
  }),
  platform: one(platforms, {
    fields: [sessions.platformId],
    references: [platforms.id],
  }),
  transactions: many(transactions),
}))

export const transactionsRelations = relations(transactions, ({ one }) => ({
  session: one(sessions, {
    fields: [transactions.sessionId],
    references: [sessions.id],
  }),
  user: one(profiles, {
    fields: [transactions.userId],
    references: [profiles.id],
  }),
  platform: one(platforms, {
    fields: [transactions.platformId],
    references: [platforms.id],
  }),
}))

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(profiles, {
    fields: [notifications.userId],
    references: [profiles.id],
  }),
}))

export const personalRecordsRelations = relations(personalRecords, ({ one }) => ({
  user: one(profiles, {
    fields: [personalRecords.userId],
    references: [profiles.id],
  }),
  session: one(sessions, {
    fields: [personalRecords.sessionId],
    references: [sessions.id],
  }),
  platform: one(platforms, {
    fields: [personalRecords.platformId],
    references: [platforms.id],
  }),
}))

export const userStreaksRelations = relations(userStreaks, ({ one }) => ({
  user: one(profiles, {
    fields: [userStreaks.userId],
    references: [profiles.id],
  }),
}))

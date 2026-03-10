/**
 * Drizzle ORM Schema: Data Collection Services
 * Tables: jackpot_snapshots, tos_snapshots, platform_health_checks, platform_alerts
 */

import { pgTable, uuid, text, boolean, decimal, timestamp, jsonb, index, check, integer } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { platforms } from './platforms';

/**
 * Jackpot Snapshots - Progressive jackpot tracking
 * Captured every 60 seconds by Replit poller service
 * Partitioned by quarter for performance
 */
export const jackpotSnapshots = pgTable('jackpot_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  platformId: uuid('platform_id').notNull().references(() => platforms.id),
  jackpotType: text('jackpot_type', {
    enum: ['mega', 'major', 'minor', 'mini', 'progressive', 'mystery', 'daily', 'hourly']
  }).notNull(),
  currentValue: decimal('current_value', { precision: 12, scale: 2 }).notNull(),
  currency: text('currency').notNull().default('USD'),
  metadata: jsonb('metadata').$type<{
    gameName?: string;
    poolId?: string;
    platformSpecific?: Record<string, unknown>;
  }>(),
  snapshotHash: text('snapshot_hash').notNull(),
  capturedAt: timestamp('captured_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  platformTimeIdx: index('idx_jackpot_snapshots_platform_time').on(table.platformId, table.capturedAt.desc()),
  typeTimeIdx: index('idx_jackpot_snapshots_type_time').on(table.jackpotType, table.capturedAt.desc()),
  hashIdx: index('idx_jackpot_snapshots_hash').on(table.snapshotHash),
  valueIdx: index('idx_jackpot_snapshots_value').on(table.currentValue.desc(), table.capturedAt.desc()),
  valueCheck: check('jackpot_snapshots_value_check', sql`current_value >= 0`),
}));

/**
 * ToS Snapshots - Terms of Service monitoring
 * Captured daily by Replit monitor service
 * Full text storage with change detection
 */
export const tosSnapshots = pgTable('tos_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  platformId: uuid('platform_id').notNull().references(() => platforms.id),
  contentText: text('content_text').notNull(),
  contentHash: text('content_hash').notNull(),
  url: text('url'),
  selectorUsed: text('selector_used'),
  wordCount: integer('word_count'),
  capturedAt: timestamp('captured_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  platformTimeIdx: index('idx_tos_snapshots_platform_time').on(table.platformId, table.capturedAt.desc()),
  hashIdx: index('idx_tos_snapshots_hash').on(table.contentHash),
  capturedIdx: index('idx_tos_snapshots_captured').on(table.capturedAt.desc()),
  // Full-text search index created via raw SQL
}));

/**
 * Platform Health Checks - Uptime and response time monitoring
 * Checked every 5 minutes by Replit health service
 */
export const platformHealthChecks = pgTable('platform_health_checks', {
  id: uuid('id').primaryKey().defaultRandom(),
  platformId: uuid('platform_id').notNull().references(() => platforms.id),
  status: text('status', {
    enum: ['healthy', 'degraded', 'down', 'error']
  }).notNull(),
  avgResponseTimeMs: decimal('avg_response_time_ms', { precision: 10, scale: 2 }),
  endpointResults: jsonb('endpoint_results').notNull().$type<{
    homepage: EndpointResult;
    login: EndpointResult;
    api?: EndpointResult;
  }>(),
  checkedAt: timestamp('checked_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  platformTimeIdx: index('idx_platform_health_platform_time').on(table.platformId, table.checkedAt.desc()),
  statusIdx: index('idx_platform_health_status').on(table.status, table.checkedAt.desc()),
  checkedIdx: index('idx_platform_health_checked').on(table.checkedAt.desc()),
  // Partial indexes created via raw SQL (WHERE clauses)
}));

/**
 * Platform Alerts - User-facing notifications
 * Created by data collection services when important events occur
 */
export const platformAlerts = pgTable('platform_alerts', {
  id: uuid('id').primaryKey().defaultRandom(),
  platformId: uuid('platform_id').notNull().references(() => platforms.id),
  alertType: text('alert_type', {
    enum: ['tos_change', 'platform_outage', 'slow_response', 'jackpot_spike', 'jackpot_won', 'maintenance']
  }).notNull(),
  severity: text('severity', {
    enum: ['low', 'medium', 'high', 'critical']
  }).notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  metadata: jsonb('metadata').$type<{
    tosChanges?: {
      addedKeywords: string[];
      removedKeywords: string[];
      diffUrl?: string;
    };
    outageDetails?: {
      failedEndpoints: string[];
      lastSuccessful?: string;
    };
    jackpotDetails?: {
      previousValue: number;
      currentValue: number;
      increasePct: number;
    };
    [key: string]: unknown;
  }>(),
  isResolved: boolean('is_resolved').default(false),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  platformIdx: index('idx_platform_alerts_platform').on(table.platformId, table.createdAt.desc()),
  typeIdx: index('idx_platform_alerts_type').on(table.alertType, table.createdAt.desc()),
  severityIdx: index('idx_platform_alerts_severity').on(table.severity, table.createdAt.desc()),
  createdIdx: index('idx_platform_alerts_created').on(table.createdAt.desc()),
  // Partial index for unresolved alerts created via raw SQL
}));

// Type exports
export type JackpotSnapshot = typeof jackpotSnapshots.$inferSelect;
export type NewJackpotSnapshot = typeof jackpotSnapshots.$inferInsert;

export type TosSnapshot = typeof tosSnapshots.$inferSelect;
export type NewTosSnapshot = typeof tosSnapshots.$inferInsert;

export type PlatformHealthCheck = typeof platformHealthChecks.$inferSelect;
export type NewPlatformHealthCheck = typeof platformHealthChecks.$inferInsert;

export type PlatformAlert = typeof platformAlerts.$inferSelect;
export type NewPlatformAlert = typeof platformAlerts.$inferInsert;

// Helper types
interface EndpointResult {
  url: string;
  status: 'healthy' | 'degraded' | 'down' | 'error';
  statusCode: number | null;
  responseTimeMs: number;
  error: string | null;
}

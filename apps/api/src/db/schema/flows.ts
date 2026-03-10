/**
 * SweepBot Flows Database Schema
 * Drizzle ORM table definitions for Flow automation engine
 */

import { pgTable, uuid, varchar, text, jsonb, timestamp, integer, boolean, decimal, index } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// ============================================================================
// FLOWS TABLE - User's Flow definitions
// ============================================================================

export const flows = pgTable(
  'flows',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description').notNull(), // original natural language input
    definition: jsonb('definition').notNull(), // FlowDefinition AST
    trigger: jsonb('trigger').notNull(), // FlowTrigger JSON
    status: varchar('status', { length: 20 }).notNull().default('draft'),
    version: integer('version').notNull().default(1),
    guardrails: jsonb('guardrails').notNull(), // ResponsiblePlayGuardrail[]
    isShared: boolean('is_shared').notNull().default(false),
    sharedFlowId: uuid('shared_flow_id'), // FK to shared_flows if this is an imported flow
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    lastExecutedAt: timestamp('last_executed_at', { withTimezone: true }),
    executionCount: integer('execution_count').notNull().default(0),
    performanceStats: jsonb('performance_stats'), // FlowPerformanceStats
  },
  (table) => ({
    // Covers listing a user's flows (the most common read operation)
    userIdx: index('idx_flows_user_id').on(table.userId),
  })
)

// ============================================================================
// FLOW EXECUTIONS TABLE - Every Flow execution is logged
// ============================================================================

export const flowExecutions = pgTable(
  'flow_executions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    flowId: uuid('flow_id').notNull().references(() => flows.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    status: varchar('status', { length: 30 }).notNull(), // running, completed, failed, stopped_by_guardrail
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    duration: integer('duration'), // milliseconds
    metrics: jsonb('metrics').notNull(), // FlowExecutionMetrics
    log: jsonb('log').notNull(), // FlowExecutionLog[]
    guardrailsTriggered: jsonb('guardrails_triggered'), // guardrails that fired
    errorDetails: text('error_details'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    // Covers fetching all executions for a specific flow (execution history page)
    flowIdx: index('idx_flow_executions_flow_id').on(table.flowId),
    // Covers fetching a user's executions across all flows
    userIdx: index('idx_flow_executions_user_id').on(table.userId),
    // Composite for user-scoped history ordered by time
    userStartedAtIdx: index('idx_flow_executions_user_started_at').on(table.userId, table.startedAt),
  })
)

// ============================================================================
// FLOW CONVERSATIONS TABLE - Multi-turn building history
// ============================================================================

export const flowConversations = pgTable(
  'flow_conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    flowId: uuid('flow_id').references(() => flows.id, { onDelete: 'set null' }), // NULL while building
    turns: jsonb('turns').notNull(), // ConversationTurn[]
    status: varchar('status', { length: 20 }).notNull(), // building, confirming, modifying, complete
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    // Covers listing a user's conversation history
    userIdx: index('idx_flow_conversations_user_id').on(table.userId),
    // Covers looking up which conversation is linked to a flow
    flowIdx: index('idx_flow_conversations_flow_id').on(table.flowId),
  })
)

// ============================================================================
// SHARED FLOWS TABLE - Marketplace
// ============================================================================

export const sharedFlows = pgTable('shared_flows', {
  id: uuid('id').primaryKey().defaultRandom(),
  creatorId: uuid('creator_id').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  category: varchar('category', { length: 50 }).notNull(), // bonus_collection, play_strategy, etc.
  tags: jsonb('tags').notNull().default(sql`'[]'::jsonb`),
  flowTemplate: jsonb('flow_template').notNull(), // Serialized FlowDefinition with placeholders
  priceCents: integer('price_cents').notNull().default(0), // 0 = free
  imports: integer('imports').notNull().default(0),
  activeUsers: integer('active_users').notNull().default(0),
  avgNetResult: decimal('avg_net_result', { precision: 10, scale: 2 }),
  avgTimeSavedMinutes: decimal('avg_time_saved_minutes', { precision: 8, scale: 2 }),
  rating: decimal('rating', { precision: 3, scale: 2 }),
  reviewCount: integer('review_count').notNull().default(0),
  verifiedPerformance: boolean('verified_performance').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/**
 * Export all tables for use in drizzle migrations and queries
 */
export const tables = { flows, flowExecutions, flowConversations, sharedFlows }

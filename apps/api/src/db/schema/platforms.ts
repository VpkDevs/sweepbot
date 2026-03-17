/**
 * Platforms Schema
 * Sweepstakes casino platform definitions
 */

import { pgTable, uuid, text, integer, boolean, timestamp, index } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

/**
 * Supported sweepstakes casino platforms
 * Seeded at deployment, expanded over time
 */
export const platforms = pgTable(
  'platforms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(), // e.g. 'chumba-casino'
    name: text('name').notNull(), // e.g. 'Chumba Casino'
    displayName: text('display_name').notNull(),
    url: text('url').notNull(),
    affiliateUrl: text('affiliate_url'),
    logoUrl: text('logo_url'),
    description: text('description'),
    foundedYear: integer('founded_year'),
    status: text('status').notNull().default('active'), // active | inactive | watchlist | suspended | closed
    countryCodes: text('country_codes')
      .array()
      .notNull()
      .default(sql`ARRAY['US']`),
    isFeatured: boolean('is_featured').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    slugIdx: index('idx_platforms_slug').on(table.slug),
    statusIdx: index('idx_platforms_status').on(table.status),
  })
)

// ============================================================================
// TypeScript Types
// ============================================================================

export type Platform = typeof platforms.$inferSelect
export type NewPlatform = typeof platforms.$inferInsert

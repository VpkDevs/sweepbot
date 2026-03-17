/**
 * Drizzle ORM Schema Index
 * Central export for all database schemas
 */

// Core user and platform schemas
export * from './profiles.js'
export * from './platforms.js'
export * from './sessions.js'
export * from './subscriptions.js'

// Flow automation engine
export * from './flows.js'

// Feature schemas
export * from './features.js'
export * from './notifications.js'

// Data collection services (jackpots, ToS, health checks)
export * from './data-collection.js'

// Quick wins features (trials, streaks, push, voice notes)
export * from './quick-wins.js'

// Trust Index scoring engine + community tables
export * from './trust.js'

// Redemptions (SC cashout tracking)
export * from './redemptions.js'

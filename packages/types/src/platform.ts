import { z } from 'zod'

// ─────────────────────────────────────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────────────────────────────────────

export const PlatformStatus = z.enum(['active', 'inactive', 'watchlist', 'suspended', 'closed'])
export type PlatformStatus = z.infer<typeof PlatformStatus>

// ─────────────────────────────────────────────────────────────────────────────
// PLATFORM
// ─────────────────────────────────────────────────────────────────────────────

export const PlatformSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  displayName: z.string().min(1).max(200),
  url: z.string().url(),
  affiliateUrl: z.string().url().nullable(),
  logoUrl: z.string().url().nullable(),
  description: z.string().nullable(),
  foundedYear: z.number().int().min(2000).max(2100).nullable(),
  status: PlatformStatus,
  countryCodes: z.array(z.string().length(2)),
  isFeatured: z.boolean(),
  trustScore: z.number().min(0).max(100).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type Platform = z.infer<typeof PlatformSchema>

// ─────────────────────────────────────────────────────────────────────────────
// USER PLATFORM (user's connection to a platform)
// ─────────────────────────────────────────────────────────────────────────────

export const UserPlatformSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  platformId: z.string().uuid(),
  isActive: z.boolean(),
  nickname: z.string().max(100).nullable(),
  addedAt: z.string().datetime(),
  lastSyncedAt: z.string().datetime().nullable(),
  platform: PlatformSchema.optional(),
})

export type UserPlatform = z.infer<typeof UserPlatformSchema>

export const AddUserPlatformSchema = z.object({
  platformId: z.string().uuid(),
  nickname: z.string().max(100).optional(),
})

export type AddUserPlatformInput = z.infer<typeof AddUserPlatformSchema>

// ─────────────────────────────────────────────────────────────────────────────
// KNOWN PLATFORM SLUGS (type-safe constants for platform detection)
// ─────────────────────────────────────────────────────────────────────────────

export const KNOWN_PLATFORM_SLUGS = [
  'chumba-casino',
  'luckylandslots',
  'stake-us',
  'pulsz',
  'wow-vegas',
  'fortune-coins',
  'funrize',
  'zula-casino',
  'crown-coins-casino',
  'mcluck',
  'nolimitcoins',
  'modo-casino',
  'sweeptastic',
  'global-poker',
  'betrivers-net',
  'high5casino',
  'jackpota',
  'spree-casino',
  'sportzino',
] as const

export type PlatformSlug = (typeof KNOWN_PLATFORM_SLUGS)[number]

// Maps platform URL patterns to slugs — used by browser extension
export const PLATFORM_URL_PATTERNS: Record<string, PlatformSlug> = {
  'chumbacasino.com': 'chumba-casino',
  'luckylandslots.com': 'luckylandslots',
  'stake.us': 'stake-us',
  'pulsz.com': 'pulsz',
  'wowvegas.com': 'wow-vegas',
  'fortunecoins.com': 'fortune-coins',
  'funrize.com': 'funrize',
  'zulacasino.com': 'zula-casino',
  'crowncoins.com': 'crown-coins-casino',
  'mcluck.com': 'mcluck',
  'nolimitcoins.com': 'nolimitcoins',
  'modo.us': 'modo-casino',
  'sweeptastic.com': 'sweeptastic',
  'globalpoker.com': 'global-poker',
  'betrivers.net': 'betrivers-net',
  'high5casino.com': 'high5casino',
  'jackpota.com': 'jackpota',
  'spreecasino.com': 'spree-casino',
  'sportzino.com': 'sportzino',
}

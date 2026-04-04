/**
 * Achievement catalogue seed.
 * 20 achievement definitions across 4 tiers (bronze/silver/gold/platinum)
 * and 4 categories (sessions, bonuses, platforms, social).
 *
 * Idempotent — uses ON CONFLICT (key) DO NOTHING so it is safe to call
 * multiple times (on startup or first load).
 *
 * Requirement types understood by checkAndAwardAchievements() in features.ts:
 *   session_count    — total sessions completed (threshold: number)
 *   unique_platforms — distinct platforms used   (threshold: number)
 *   bonus_sessions   — sessions where bonus_triggered = true (threshold: number)
 *   big_win_submitted — at least one verified big win submitted (no threshold)
 */

import { sql } from 'drizzle-orm'
import { query } from '../client.js'

// ── Catalogue definition ──────────────────────────────────────────────────────

interface AchievementSeed {
  key: string
  name: string
  description: string
  icon: string // lucide-react icon name (display only)
  category: string // sessions | bonuses | platforms | social | flows
  tier: string // bronze | silver | gold | platinum
  points: number
  requirement: Record<string, unknown>
  isSecret: boolean
}

const ACHIEVEMENTS: AchievementSeed[] = [
  // ── BRONZE — Sessions ──────────────────────────────────────────────────────
  {
    key: 'first_session',
    name: 'First Steps',
    description: 'Complete your very first session.',
    icon: 'Footprints',
    category: 'sessions',
    tier: 'bronze',
    points: 50,
    requirement: { type: 'session_count', threshold: 1 },
    isSecret: false,
  },
  {
    key: 'sessions_5',
    name: 'Getting Warmed Up',
    description: 'Complete 5 sessions.',
    icon: 'Flame',
    category: 'sessions',
    tier: 'bronze',
    points: 75,
    requirement: { type: 'session_count', threshold: 5 },
    isSecret: false,
  },

  // ── BRONZE — Bonuses ───────────────────────────────────────────────────────
  {
    key: 'first_bonus',
    name: 'Freebie Hunter',
    description: 'Play your first session with a bonus triggered.',
    icon: 'Gift',
    category: 'bonuses',
    tier: 'bronze',
    points: 75,
    requirement: { type: 'bonus_sessions', threshold: 1 },
    isSecret: false,
  },

  // ── BRONZE — Platforms ─────────────────────────────────────────────────────
  {
    key: 'platforms_2',
    name: 'Explorer',
    description: 'Play on 2 different platforms.',
    icon: 'Compass',
    category: 'platforms',
    tier: 'bronze',
    points: 75,
    requirement: { type: 'unique_platforms', threshold: 2 },
    isSecret: false,
  },

  // ── BRONZE — Social ────────────────────────────────────────────────────────
  {
    key: 'first_big_win',
    name: 'Lucky Reporter',
    description: 'Submit your first big win to the community board.',
    icon: 'Trophy',
    category: 'social',
    tier: 'bronze',
    points: 100,
    requirement: { type: 'big_win_submitted' },
    isSecret: false,
  },

  // ── SILVER — Sessions ──────────────────────────────────────────────────────
  {
    key: 'sessions_25',
    name: 'Regular Player',
    description: 'Complete 25 sessions.',
    icon: 'CalendarCheck',
    category: 'sessions',
    tier: 'silver',
    points: 150,
    requirement: { type: 'session_count', threshold: 25 },
    isSecret: false,
  },
  {
    key: 'sessions_50',
    name: 'Dedicated Grinder',
    description: 'Complete 50 sessions.',
    icon: 'Dumbbell',
    category: 'sessions',
    tier: 'silver',
    points: 200,
    requirement: { type: 'session_count', threshold: 50 },
    isSecret: false,
  },

  // ── SILVER — Bonuses ───────────────────────────────────────────────────────
  {
    key: 'bonus_sessions_10',
    name: 'Bonus Collector',
    description: 'Trigger bonuses in 10 different sessions.',
    icon: 'Sparkles',
    category: 'bonuses',
    tier: 'silver',
    points: 175,
    requirement: { type: 'bonus_sessions', threshold: 10 },
    isSecret: false,
  },
  {
    key: 'bonus_sessions_25',
    name: 'Bonus Addict',
    description: 'Trigger bonuses in 25 different sessions.',
    icon: 'Zap',
    category: 'bonuses',
    tier: 'silver',
    points: 225,
    requirement: { type: 'bonus_sessions', threshold: 25 },
    isSecret: false,
  },

  // ── SILVER — Platforms ─────────────────────────────────────────────────────
  {
    key: 'platforms_3',
    name: 'Multi-Platform Pro',
    description: 'Play sessions on 3 different platforms.',
    icon: 'Globe',
    category: 'platforms',
    tier: 'silver',
    points: 175,
    requirement: { type: 'unique_platforms', threshold: 3 },
    isSecret: false,
  },

  // ── GOLD — Sessions ────────────────────────────────────────────────────────
  {
    key: 'sessions_100',
    name: 'Century Club',
    description: 'Complete 100 sessions. You are in the top tier now.',
    icon: 'Medal',
    category: 'sessions',
    tier: 'gold',
    points: 300,
    requirement: { type: 'session_count', threshold: 100 },
    isSecret: false,
  },
  {
    key: 'sessions_250',
    name: 'Marathon Runner',
    description: 'Complete 250 sessions.',
    icon: 'Activity',
    category: 'sessions',
    tier: 'gold',
    points: 400,
    requirement: { type: 'session_count', threshold: 250 },
    isSecret: false,
  },

  // ── GOLD — Bonuses ─────────────────────────────────────────────────────────
  {
    key: 'bonus_sessions_50',
    name: 'Bonus Maestro',
    description: 'Trigger bonuses in 50 different sessions.',
    icon: 'Star',
    category: 'bonuses',
    tier: 'gold',
    points: 325,
    requirement: { type: 'bonus_sessions', threshold: 50 },
    isSecret: false,
  },
  {
    key: 'bonus_sessions_100',
    name: 'Bonus Hunting Pro',
    description: 'Trigger bonuses in 100 different sessions.',
    icon: 'Award',
    category: 'bonuses',
    tier: 'gold',
    points: 425,
    requirement: { type: 'bonus_sessions', threshold: 100 },
    isSecret: false,
  },

  // ── GOLD — Platforms ───────────────────────────────────────────────────────
  {
    key: 'platforms_5',
    name: 'Platform Collector',
    description: 'Play on 5 different sweepstakes platforms.',
    icon: 'LayoutGrid',
    category: 'platforms',
    tier: 'gold',
    points: 350,
    requirement: { type: 'unique_platforms', threshold: 5 },
    isSecret: false,
  },

  // ── PLATINUM — Sessions ────────────────────────────────────────────────────
  {
    key: 'sessions_500',
    name: 'Elite Grinder',
    description: 'Complete 500 sessions. True dedication.',
    icon: 'Crown',
    category: 'sessions',
    tier: 'platinum',
    points: 600,
    requirement: { type: 'session_count', threshold: 500 },
    isSecret: false,
  },
  {
    key: 'sessions_1000',
    name: 'Legend',
    description: 'Reach 1,000 sessions. An absolute legend.',
    icon: 'Gem',
    category: 'sessions',
    tier: 'platinum',
    points: 750,
    requirement: { type: 'session_count', threshold: 1000 },
    isSecret: true,
  },

  // ── PLATINUM — Bonuses ─────────────────────────────────────────────────────
  {
    key: 'bonus_sessions_200',
    name: 'Bonus King',
    description: 'Trigger bonuses in 200 sessions.',
    icon: 'Coins',
    category: 'bonuses',
    tier: 'platinum',
    points: 550,
    requirement: { type: 'bonus_sessions', threshold: 200 },
    isSecret: false,
  },
  {
    key: 'bonus_sessions_500',
    name: 'Ultimate Bonus Hunter',
    description: 'Trigger bonuses in 500 sessions. Legendary bonus instincts.',
    icon: 'Wand',
    category: 'bonuses',
    tier: 'platinum',
    points: 700,
    requirement: { type: 'bonus_sessions', threshold: 500 },
    isSecret: true,
  },

  // ── PLATINUM — Platforms ───────────────────────────────────────────────────
  {
    key: 'platforms_8',
    name: 'Platform Guru',
    description: 'Conquer 8 different sweepstakes platforms.',
    icon: 'Network',
    category: 'platforms',
    tier: 'platinum',
    points: 600,
    requirement: { type: 'unique_platforms', threshold: 8 },
    isSecret: false,
  },
]

// ── Seed function ─────────────────────────────────────────────────────────────

/**
 * Seed the achievements table with the predefined catalogue.
 *
 * Inserts each entry from ACHIEVEMENTS and uses ON CONFLICT (key) DO NOTHING so existing rows are not modified; safe to call repeatedly (idempotent).
 */
export async function seedAchievements(): Promise<void> {
  for (const a of ACHIEVEMENTS) {
    await query(sql`
      INSERT INTO achievements (key, name, description, icon, category, tier, points, requirement, is_secret)
      VALUES (
        ${a.key},
        ${a.name},
        ${a.description},
        ${a.icon},
        ${a.category},
        ${a.tier},
        ${a.points},
        ${JSON.stringify(a.requirement)}::jsonb,
        ${a.isSecret}
      )
      ON CONFLICT (key) DO NOTHING
    `)
  }
}

/**
 * Determine whether the achievements table contains no rows.
 *
 * @returns `true` if the achievements table contains no rows, `false` otherwise.
 */
export async function achievementsEmpty(): Promise<boolean> {
  const { rows } = await query<{ count: number }>(sql`
    SELECT COUNT(*)::int AS count FROM achievements
  `)
  return (rows[0]?.count ?? 0) === 0
}

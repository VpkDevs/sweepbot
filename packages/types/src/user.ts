import { z } from 'zod'
import type { SubscriptionTier } from './subscription'

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE
// ─────────────────────────────────────────────────────────────────────────────

export const ProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().min(1).max(50).nullable(),
  avatarUrl: z.string().url().nullable(),
  bio: z.string().max(500).nullable(),
  tier: z.enum(['free', 'starter', 'pro', 'analyst', 'elite', 'lifetime']),
  timezone: z.string(),
  locale: z.string(),
  onboardedAt: z.string().datetime().nullable(),
  lastSeenAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type Profile = z.infer<typeof ProfileSchema>

export const UpdateProfileSchema = ProfileSchema.pick({
  displayName: true,
  avatarUrl: true,
  bio: true,
  timezone: true,
  locale: true,
}).partial()

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>

// ─────────────────────────────────────────────────────────────────────────────
// USER SETTINGS
// ─────────────────────────────────────────────────────────────────────────────

export const UserSettingsSchema = z.object({
  userId: z.string().uuid(),
  // Notifications
  notifyJackpotAlerts: z.boolean(),
  notifyTosChanges: z.boolean(),
  notifyRedemptionUpdates: z.boolean(),
  notifyWeeklySummary: z.boolean(),
  notifyBonusAlerts: z.boolean(),
  // Responsible Play
  sessionTimeLimitMins: z.number().int().min(15).max(480).nullable(),
  dailyLossLimitUsd: z.number().min(0).nullable(),
  weeklyLossLimitUsd: z.number().min(0).nullable(),
  cooldownEnabled: z.boolean(),
  // Display
  currencyDisplay: z.string().default('USD'),
  theme: z.enum(['dark', 'light', 'system']).default('dark'),
  dashboardLayout: z.record(z.unknown()).nullable(),
  updatedAt: z.string().datetime(),
})

export type UserSettings = z.infer<typeof UserSettingsSchema>

export const UpdateUserSettingsSchema = UserSettingsSchema.omit({
  userId: true,
  updatedAt: true,
}).partial()

export type UpdateUserSettingsInput = z.infer<typeof UpdateUserSettingsSchema>

// ─────────────────────────────────────────────────────────────────────────────
// SUBSCRIPTION TIER FEATURES (for feature-gating)
// ─────────────────────────────────────────────────────────────────────────────

export interface TierFeatures {
  maxPlatforms: number
  historyDays: number
  automationRuns: number | 'unlimited'
  advancedAnalytics: boolean
  rtpTracking: boolean
  gameDatabase: boolean
  bonusAnalytics: boolean
  taxCenter: boolean
  dataExport: boolean
  apiAccess: boolean
  communityRtpData: boolean
  mailScraper: boolean
  householdUsers: number
  prioritySupport: boolean
}

export const TIER_FEATURES: Record<SubscriptionTier, TierFeatures> = {
  free: {
    maxPlatforms: 2,
    historyDays: 7,
    automationRuns: 0,
    advancedAnalytics: false,
    rtpTracking: false,
    gameDatabase: false,
    bonusAnalytics: false,
    taxCenter: false,
    dataExport: false,
    apiAccess: false,
    communityRtpData: false,
    mailScraper: false,
    householdUsers: 1,
    prioritySupport: false,
  },
  starter: {
    maxPlatforms: 8,
    historyDays: 90,
    automationRuns: 1,
    advancedAnalytics: false,
    rtpTracking: true,
    gameDatabase: false,
    bonusAnalytics: false,
    taxCenter: false,
    dataExport: false,
    apiAccess: false,
    communityRtpData: false,
    mailScraper: true,
    householdUsers: 1,
    prioritySupport: false,
  },
  pro: {
    maxPlatforms: 999,
    historyDays: 365,
    automationRuns: 'unlimited',
    advancedAnalytics: true,
    rtpTracking: true,
    gameDatabase: false,
    bonusAnalytics: true,
    taxCenter: false,
    dataExport: true,
    apiAccess: false,
    communityRtpData: false,
    mailScraper: true,
    householdUsers: 3,
    prioritySupport: false,
  },
  analyst: {
    maxPlatforms: 999,
    historyDays: 730,
    automationRuns: 'unlimited',
    advancedAnalytics: true,
    rtpTracking: true,
    gameDatabase: true,
    bonusAnalytics: true,
    taxCenter: true,
    dataExport: true,
    apiAccess: false,
    communityRtpData: true,
    mailScraper: true,
    householdUsers: 3,
    prioritySupport: false,
  },
  elite: {
    maxPlatforms: 999,
    historyDays: 730,
    automationRuns: 'unlimited',
    advancedAnalytics: true,
    rtpTracking: true,
    gameDatabase: true,
    bonusAnalytics: true,
    taxCenter: true,
    dataExport: true,
    apiAccess: true,
    communityRtpData: true,
    mailScraper: true,
    householdUsers: 6,
    prioritySupport: true,
  },
  lifetime: {
    maxPlatforms: 999,
    historyDays: 365,
    automationRuns: 'unlimited',
    advancedAnalytics: true,
    rtpTracking: true,
    gameDatabase: false,
    bonusAnalytics: true,
    taxCenter: false,
    dataExport: true,
    apiAccess: false,
    communityRtpData: false,
    mailScraper: true,
    householdUsers: 1,
    prioritySupport: false,
  },
}

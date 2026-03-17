import { z } from 'zod'
import type { SubscriptionTier } from './subscription'
export declare const ProfileSchema: z.ZodObject<
  {
    id: z.ZodString
    email: z.ZodString
    displayName: z.ZodNullable<z.ZodString>
    avatarUrl: z.ZodNullable<z.ZodString>
    bio: z.ZodNullable<z.ZodString>
    tier: z.ZodEnum<['free', 'starter', 'pro', 'analyst', 'elite', 'lifetime']>
    timezone: z.ZodString
    locale: z.ZodString
    onboardedAt: z.ZodNullable<z.ZodString>
    lastSeenAt: z.ZodNullable<z.ZodString>
    createdAt: z.ZodString
    updatedAt: z.ZodString
  },
  'strip',
  z.ZodTypeAny,
  {
    id: string
    tier: 'free' | 'starter' | 'pro' | 'analyst' | 'elite' | 'lifetime'
    displayName: string | null
    timezone: string
    avatarUrl: string | null
    bio: string | null
    email: string
    createdAt: string
    updatedAt: string
    locale: string
    onboardedAt: string | null
    lastSeenAt: string | null
  },
  {
    id: string
    tier: 'free' | 'starter' | 'pro' | 'analyst' | 'elite' | 'lifetime'
    displayName: string | null
    timezone: string
    avatarUrl: string | null
    bio: string | null
    email: string
    createdAt: string
    updatedAt: string
    locale: string
    onboardedAt: string | null
    lastSeenAt: string | null
  }
>
export type Profile = z.infer<typeof ProfileSchema>
export declare const UpdateProfileSchema: z.ZodObject<
  {
    displayName: z.ZodOptional<z.ZodNullable<z.ZodString>>
    timezone: z.ZodOptional<z.ZodString>
    avatarUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>
    bio: z.ZodOptional<z.ZodNullable<z.ZodString>>
    locale: z.ZodOptional<z.ZodString>
  },
  'strip',
  z.ZodTypeAny,
  {
    displayName?: string | null | undefined
    timezone?: string | undefined
    avatarUrl?: string | null | undefined
    bio?: string | null | undefined
    locale?: string | undefined
  },
  {
    displayName?: string | null | undefined
    timezone?: string | undefined
    avatarUrl?: string | null | undefined
    bio?: string | null | undefined
    locale?: string | undefined
  }
>
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>
export declare const UserSettingsSchema: z.ZodObject<
  {
    userId: z.ZodString
    notifyJackpotAlerts: z.ZodBoolean
    notifyTosChanges: z.ZodBoolean
    notifyRedemptionUpdates: z.ZodBoolean
    notifyWeeklySummary: z.ZodBoolean
    notifyBonusAlerts: z.ZodBoolean
    sessionTimeLimitMins: z.ZodNullable<z.ZodNumber>
    dailyLossLimitUsd: z.ZodNullable<z.ZodNumber>
    weeklyLossLimitUsd: z.ZodNullable<z.ZodNumber>
    cooldownEnabled: z.ZodBoolean
    currencyDisplay: z.ZodDefault<z.ZodString>
    theme: z.ZodDefault<z.ZodEnum<['dark', 'light', 'system']>>
    dashboardLayout: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>
    updatedAt: z.ZodString
  },
  'strip',
  z.ZodTypeAny,
  {
    currencyDisplay: string
    dashboardLayout: Record<string, unknown> | null
    userId: string
    updatedAt: string
    notifyJackpotAlerts: boolean
    notifyTosChanges: boolean
    notifyRedemptionUpdates: boolean
    notifyWeeklySummary: boolean
    notifyBonusAlerts: boolean
    sessionTimeLimitMins: number | null
    dailyLossLimitUsd: number | null
    weeklyLossLimitUsd: number | null
    cooldownEnabled: boolean
    theme: 'dark' | 'light' | 'system'
  },
  {
    dashboardLayout: Record<string, unknown> | null
    userId: string
    updatedAt: string
    notifyJackpotAlerts: boolean
    notifyTosChanges: boolean
    notifyRedemptionUpdates: boolean
    notifyWeeklySummary: boolean
    notifyBonusAlerts: boolean
    sessionTimeLimitMins: number | null
    dailyLossLimitUsd: number | null
    weeklyLossLimitUsd: number | null
    cooldownEnabled: boolean
    currencyDisplay?: string | undefined
    theme?: 'dark' | 'light' | 'system' | undefined
  }
>
export type UserSettings = z.infer<typeof UserSettingsSchema>
export declare const UpdateUserSettingsSchema: z.ZodObject<
  {
    currencyDisplay: z.ZodOptional<z.ZodDefault<z.ZodString>>
    dashboardLayout: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>
    notifyJackpotAlerts: z.ZodOptional<z.ZodBoolean>
    notifyTosChanges: z.ZodOptional<z.ZodBoolean>
    notifyRedemptionUpdates: z.ZodOptional<z.ZodBoolean>
    notifyWeeklySummary: z.ZodOptional<z.ZodBoolean>
    notifyBonusAlerts: z.ZodOptional<z.ZodBoolean>
    sessionTimeLimitMins: z.ZodOptional<z.ZodNullable<z.ZodNumber>>
    dailyLossLimitUsd: z.ZodOptional<z.ZodNullable<z.ZodNumber>>
    weeklyLossLimitUsd: z.ZodOptional<z.ZodNullable<z.ZodNumber>>
    cooldownEnabled: z.ZodOptional<z.ZodBoolean>
    theme: z.ZodOptional<z.ZodDefault<z.ZodEnum<['dark', 'light', 'system']>>>
  },
  'strip',
  z.ZodTypeAny,
  {
    currencyDisplay?: string | undefined
    dashboardLayout?: Record<string, unknown> | null | undefined
    notifyJackpotAlerts?: boolean | undefined
    notifyTosChanges?: boolean | undefined
    notifyRedemptionUpdates?: boolean | undefined
    notifyWeeklySummary?: boolean | undefined
    notifyBonusAlerts?: boolean | undefined
    sessionTimeLimitMins?: number | null | undefined
    dailyLossLimitUsd?: number | null | undefined
    weeklyLossLimitUsd?: number | null | undefined
    cooldownEnabled?: boolean | undefined
    theme?: 'dark' | 'light' | 'system' | undefined
  },
  {
    currencyDisplay?: string | undefined
    dashboardLayout?: Record<string, unknown> | null | undefined
    notifyJackpotAlerts?: boolean | undefined
    notifyTosChanges?: boolean | undefined
    notifyRedemptionUpdates?: boolean | undefined
    notifyWeeklySummary?: boolean | undefined
    notifyBonusAlerts?: boolean | undefined
    sessionTimeLimitMins?: number | null | undefined
    dailyLossLimitUsd?: number | null | undefined
    weeklyLossLimitUsd?: number | null | undefined
    cooldownEnabled?: boolean | undefined
    theme?: 'dark' | 'light' | 'system' | undefined
  }
>
export type UpdateUserSettingsInput = z.infer<typeof UpdateUserSettingsSchema>
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
export declare const TIER_FEATURES: Record<SubscriptionTier, TierFeatures>
//# sourceMappingURL=user.d.ts.map

import { z } from 'zod'
export declare const SubscriptionTierSchema: z.ZodEnum<
  ['free', 'starter', 'pro', 'analyst', 'elite', 'lifetime']
>
export type SubscriptionTier = z.infer<typeof SubscriptionTierSchema>
export declare const SubscriptionStatusSchema: z.ZodEnum<
  ['active', 'trialing', 'past_due', 'cancelled', 'paused']
>
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>
export declare const SubscriptionSchema: z.ZodObject<
  {
    id: z.ZodString
    userId: z.ZodString
    stripeSubscriptionId: z.ZodNullable<z.ZodString>
    stripePriceId: z.ZodNullable<z.ZodString>
    tier: z.ZodEnum<['free', 'starter', 'pro', 'analyst', 'elite', 'lifetime']>
    status: z.ZodEnum<['active', 'trialing', 'past_due', 'cancelled', 'paused']>
    currentPeriodStart: z.ZodNullable<z.ZodString>
    currentPeriodEnd: z.ZodNullable<z.ZodString>
    cancelAtPeriodEnd: z.ZodBoolean
    trialEnd: z.ZodNullable<z.ZodString>
    createdAt: z.ZodString
    updatedAt: z.ZodString
  },
  'strip',
  z.ZodTypeAny,
  {
    status: 'active' | 'trialing' | 'past_due' | 'cancelled' | 'paused'
    id: string
    tier: 'free' | 'starter' | 'pro' | 'analyst' | 'elite' | 'lifetime'
    userId: string
    createdAt: string
    updatedAt: string
    stripeSubscriptionId: string | null
    stripePriceId: string | null
    currentPeriodStart: string | null
    currentPeriodEnd: string | null
    cancelAtPeriodEnd: boolean
    trialEnd: string | null
  },
  {
    status: 'active' | 'trialing' | 'past_due' | 'cancelled' | 'paused'
    id: string
    tier: 'free' | 'starter' | 'pro' | 'analyst' | 'elite' | 'lifetime'
    userId: string
    createdAt: string
    updatedAt: string
    stripeSubscriptionId: string | null
    stripePriceId: string | null
    currentPeriodStart: string | null
    currentPeriodEnd: string | null
    cancelAtPeriodEnd: boolean
    trialEnd: string | null
  }
>
export type Subscription = z.infer<typeof SubscriptionSchema>
export interface PricingPlan {
  tier: SubscriptionTier
  name: string
  priceMonthly: number | null
  priceAnnual: number | null
  priceLifetime: number | null
  householdUsers: number
  tagline: string
  features: string[]
  isPopular?: boolean
}
export declare const PRICING_PLANS: PricingPlan[]
//# sourceMappingURL=subscription.d.ts.map

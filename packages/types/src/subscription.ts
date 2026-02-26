import { z } from 'zod'

export const SubscriptionTierSchema = z.enum(['free', 'starter', 'pro', 'analyst', 'elite', 'lifetime'])
export type SubscriptionTier = z.infer<typeof SubscriptionTierSchema>

export const SubscriptionStatusSchema = z.enum(['active', 'trialing', 'past_due', 'cancelled', 'paused'])
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>

export const SubscriptionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  stripeSubscriptionId: z.string().nullable(),
  stripePriceId: z.string().nullable(),
  tier: SubscriptionTierSchema,
  status: SubscriptionStatusSchema,
  currentPeriodStart: z.string().datetime().nullable(),
  currentPeriodEnd: z.string().datetime().nullable(),
  cancelAtPeriodEnd: z.boolean(),
  trialEnd: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type Subscription = z.infer<typeof SubscriptionSchema>

// Pricing table constants (source of truth for all pricing displays)
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

export const PRICING_PLANS: PricingPlan[] = [
  {
    tier: 'free',
    name: 'Free',
    priceMonthly: 0,
    priceAnnual: 0,
    priceLifetime: null,
    householdUsers: 1,
    tagline: 'Get started, no credit card required',
    features: [
      'Track up to 2 platforms',
      '7-day session history',
      'Basic RTP tracking',
      'Affiliate links (earn referral bonuses)',
      'Extension with RTP overlay',
    ],
  },
  {
    tier: 'starter',
    name: 'Starter',
    priceMonthly: 14.99,
    priceAnnual: 119,
    priceLifetime: null,
    householdUsers: 1,
    tagline: 'For the serious player',
    features: [
      'Track up to 8 platforms',
      '90-day session history',
      'Full RTP tracking with confidence intervals',
      '1 automated bonus run per day',
      'Gmail mail bonus detection',
      'Daily session summaries',
      'Wagering requirement tracker',
    ],
  },
  {
    tier: 'pro',
    name: 'Pro',
    priceMonthly: 29.99,
    priceAnnual: 239,
    priceLifetime: null,
    householdUsers: 3,
    tagline: 'For the power grinder',
    isPopular: true,
    features: [
      'Unlimited platform tracking',
      '1-year session history',
      'Smart automation scheduling',
      'Full mail bonus scraper',
      'Advanced analytics & bonus analytics',
      'Redemption tracker',
      'CSV/PDF data export',
      '3 household users',
    ],
  },
  {
    tier: 'analyst',
    name: 'Analyst',
    priceMonthly: 39.99,
    priceAnnual: 319,
    priceLifetime: null,
    householdUsers: 3,
    tagline: 'The Bloomberg Terminal',
    features: [
      'Everything in Pro',
      'Full bonus feature analytics',
      'Game Intelligence Database access',
      'Community-aggregate RTP data',
      'Tax Center with 1099 tools',
      '2-year session history',
    ],
  },
  {
    tier: 'elite',
    name: 'Elite',
    priceMonthly: 59.99,
    priceAnnual: 399,
    priceLifetime: null,
    householdUsers: 6,
    tagline: 'Maximum power, maximum insight',
    features: [
      'Everything in Analyst',
      'API access (B2B data)',
      '6 household users',
      'White-glove onboarding',
      'Priority feature requests',
      'Private community access',
    ],
  },
  {
    tier: 'lifetime',
    name: 'Lifetime',
    priceMonthly: null,
    priceAnnual: null,
    priceLifetime: 499,
    householdUsers: 1,
    tagline: 'Pay once, use forever (Pro tier)',
    features: [
      'All Pro features, forever',
      'All future Pro updates included',
      'No recurring fees',
      'Limited availability',
    ],
  },
]

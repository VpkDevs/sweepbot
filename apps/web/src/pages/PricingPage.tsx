import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Zap,
  CheckCircle2,
  Shield,
  BarChart2,
  Cpu,
  Users,
  Star,
  ArrowRight,
  Loader2,
  Gift,
} from 'lucide-react'
import { api } from '../lib/api'
import { useAuthStore } from '../stores/auth'
import { cn } from '../lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type BillingCycle = 'monthly' | 'annual'

type PlanTier = 'free' | 'starter' | 'pro' | 'analyst' | 'elite' | 'lifetime'

interface PlanConfig {
  id: PlanTier
  name: string
  tagline: string
  priceMonthly: number | null
  priceAnnual: number | null
  priceLifetime?: number
  badge?: string
  badgeColor?: string
  features: string[]
  limits: {
    platforms: number | 'Unlimited'
    history: string
    automationRuns: string
  }
  cta: string
  highlighted?: boolean
}

const PLANS: PlanConfig[] = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'Start tracking immediately',
    priceMonthly: 0,
    priceAnnual: 0,
    features: [
      'Track up to 2 platforms',
      '7-day session history',
      'Basic RTP display',
      'Read-only community access',
      'Affiliate link support',
      'SweepBot Trust Index access',
    ],
    limits: { platforms: 2, history: '7 days', automationRuns: 'Manual only' },
    cta: 'Get Started Free',
  },
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'For the regular grinder',
    priceMonthly: 14.99,
    priceAnnual: 119,
    features: [
      'Track up to 8 platforms',
      '90-day session history',
      '1 daily auto-run per platform',
      'Gmail bonus mail integration',
      'Daily summary emails',
      'Redemption tracker',
      'Full community access',
    ],
    limits: { platforms: 8, history: '90 days', automationRuns: '1/day per platform' },
    cta: 'Start Starter',
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'The complete sweeper toolkit',
    priceMonthly: 29.99,
    priceAnnual: 239,
    badge: 'Most Popular',
    badgeColor: 'bg-brand-600 text-white',
    features: [
      'Unlimited platforms',
      '1-year session history',
      'Smart scheduling & priority queuing',
      'Full mail bonus scraper',
      'Advanced analytics dashboard',
      'Bonus calendar & alerts',
      'Jackpot surge alerts',
      'TOS change monitoring',
      'Household plan — 3 users',
    ],
    limits: { platforms: 'Unlimited', history: '1 year', automationRuns: 'Smart scheduled' },
    cta: 'Go Pro',
    highlighted: true,
  },
  {
    id: 'analyst',
    name: 'Analyst',
    tagline: 'Data-driven performance transparency',
    priceMonthly: 39.99,
    priceAnnual: 319,
    badge: 'Best Value',
    badgeColor: 'bg-amber-700 text-white',
    features: [
      'Everything in Pro',
      'Full personal RTP tracking',
      'Bonus feature analytics',
      'Game Intelligence database',
      'Community RTP data access',
      'Tax center & PDF exports',
      'Provider-level analytics',
      'Temporal pattern analysis',
      'Household plan — 3 users',
    ],
    limits: { platforms: 'Unlimited', history: '2 years', automationRuns: 'Smart scheduled' },
    cta: 'Go Analyst',
  },
  {
    id: 'elite',
    name: 'Elite',
    tagline: 'Maximum intelligence, maximum clarity',
    priceMonthly: 59.99,
    priceAnnual: 399,
    features: [
      'Everything in Analyst',
      'Household plan — 6 users',
      'API access',
      'White-glove onboarding',
      'Private Elite community',
      'Custom automation scripts',
      'Priority feature requests',
      'Dedicated support channel',
      'Early access to new features',
    ],
    limits: { platforms: 'Unlimited', history: 'Unlimited', automationRuns: 'Unlimited' },
    cta: 'Go Elite',
  },
]

const LIFETIME_PLAN: PlanConfig = {
  id: 'lifetime',
  name: 'Lifetime Pro',
  tagline: 'Pay once, own it forever',
  priceMonthly: null,
  priceAnnual: null,
  priceLifetime: 499,
  badge: 'Limited Time',
  badgeColor: 'bg-gradient-to-r from-amber-600 to-orange-600 text-white',
  features: [
    'Pro-tier features for life',
    'All future Pro updates',
    'Lifetime community access',
    'No recurring charges ever',
    'Founding member badge',
  ],
  limits: { platforms: 'Unlimited', history: '1 year', automationRuns: 'Smart scheduled' },
  cta: 'Buy Lifetime — $499',
}

// ─── Feature comparison ───────────────────────────────────────────────────────

const COMPARISON_ROWS = [
  { label: 'Platforms', key: 'platforms' as const },
  { label: 'History', key: 'history' as const },
  { label: 'Auto-runs', key: 'automationRuns' as const },
]

// ─── Plan card ────────────────────────────────────────────────────────────────

function PlanCard({
  plan,
  cycle,
  currentTier,
  onSelect,
  loading,
}: {
  plan: PlanConfig
  cycle: BillingCycle
  currentTier: string | null
  onSelect: (tier: PlanTier) => void
  loading: string | null
}) {
  const price = cycle === 'annual' ? plan.priceAnnual : plan.priceMonthly
  const monthlyEquiv = cycle === 'annual' && plan.priceAnnual ? plan.priceAnnual / 12 : price
  const annualSavings =
    plan.priceMonthly !== null && plan.priceAnnual !== null
      ? plan.priceMonthly * 12 - plan.priceAnnual
      : null
  const isCurrentPlan = currentTier === plan.id
  const isUpgrade = !isCurrentPlan

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-2xl border bg-zinc-900 p-6',
        plan.highlighted
          ? 'border-brand-500 ring-brand-500/20 scale-[1.02] ring-2'
          : 'border-zinc-800'
      )}
    >
      {plan.badge && (
        <div
          className={cn(
            'absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-0.5 text-xs font-bold',
            plan.badgeColor
          )}
        >
          {plan.badge}
        </div>
      )}

      <div className="mb-4">
        <h3 className="text-base font-bold text-white">{plan.name}</h3>
        <p className="mt-0.5 text-xs text-zinc-500">{plan.tagline}</p>
      </div>

      {/* Price */}
      <div className="mb-6">
        {price === 0 ? (
          <p className="text-3xl font-black text-white">Free</p>
        ) : price !== null ? (
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-white">
                ${cycle === 'annual' ? monthlyEquiv?.toFixed(2) ?? price?.toFixed(2) : price}
              </span>
              <span className="text-sm text-zinc-500">/mo</span>
            </div>
            {cycle === 'annual' && annualSavings !== null && (
              <p className="mt-0.5 text-xs text-zinc-500">
                Billed ${plan.priceAnnual} annually
                <span className="ml-1 text-green-400">
                  (save ${annualSavings.toFixed(0)})
                </span>
              </p>
            )}
          </div>
        ) : null}
      </div>

      {/* Feature list */}
      <ul className="mb-6 flex-1 space-y-2">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-zinc-400">
            <CheckCircle2 className="text-brand-500 mt-0.5 h-4 w-4 shrink-0" />
            {f}
          </li>
        ))}
      </ul>

      {/* Limits summary */}
      <div className="mb-6 grid grid-cols-3 gap-1 text-center">
        {COMPARISON_ROWS.map(({ label, key }) => (
          <div key={key} className="rounded-lg bg-zinc-800/60 p-1.5">
            <p className="text-[9px] uppercase text-zinc-600">{label}</p>
            <p className="mt-0.5 text-xs font-semibold text-zinc-300">{String(plan.limits[key])}</p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <button
        onClick={() => onSelect(plan.id)}
        disabled={isCurrentPlan || loading === plan.id}
        className={cn(
          'flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-colors',
          isCurrentPlan
            ? 'cursor-default bg-zinc-800 text-zinc-500'
            : plan.highlighted
              ? 'bg-brand-600 hover:bg-brand-500 text-white'
              : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white'
        )}
      >
        {loading === plan.id && <Loader2 className="h-4 w-4 animate-spin" />}
        {isCurrentPlan ? 'Current Plan' : plan.cta}
        {isUpgrade && !isCurrentPlan && loading !== plan.id && <ArrowRight className="h-4 w-4" />}
      </button>
    </div>
  )
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────

const FAQ = [
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Cancel at any time from Settings → Subscription. You keep access until the end of your billing period.',
  },
  {
    q: 'What counts as a "platform"?',
    a: 'Each sweepstakes casino site (Chumba, Pulsz, etc.) counts as one platform. Free plan allows 2, Starter 8, Pro/Analyst/Elite unlimited.',
  },
  {
    q: 'Is my data safe?',
    a: 'Yes. Credentials are stored AES-256 encrypted locally and never transmitted in plaintext. Your play data is private to your account.',
  },
  {
    q: 'Does SweepBot tell me what to bet or when to play?',
    a: 'No. SweepBot is a tracking and automation tool. We provide data and transparency — we never give gambling advice or recommend specific plays.',
  },
  {
    q: 'How does the Lifetime deal work?',
    a: 'You pay $499 once and get Pro-tier access forever, including all future Pro updates. These are offered periodically — not always available.',
  },
  {
    q: 'What is the Household plan?',
    a: 'Pro/Analyst plans include up to 3 users sharing one subscription. Elite includes up to 6. Each user gets their own tracked data and stats.',
  },
]

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-zinc-800 last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 py-4 text-left"
      >
        <p className="text-sm font-medium text-white">{q}</p>
        <span
          className={cn(
            'text-lg leading-none text-zinc-500 transition-transform',
            open && 'rotate-180'
          )}
        >
          ›
        </span>
      </button>
      {open && <p className="pb-4 text-sm text-zinc-400">{a}</p>}
    </div>
  )
}

// ─── Feature icons strip ──────────────────────────────────────────────────────

const FEATURE_PILLARS = [
  { icon: Zap, label: 'Automation Engine', description: 'Claim bonuses on autopilot' },
  {
    icon: BarChart2,
    label: 'Analytics Intelligence',
    description: 'Personal RTP & bonus tracking',
  },
  { icon: Shield, label: 'Trust Index', description: 'Know which platforms to trust' },
  { icon: Cpu, label: 'Jackpot Intelligence', description: 'Real-time progressive tracking' },
  { icon: Star, label: 'Game Database', description: 'Per-game RTP profiles' },
  { icon: Users, label: 'Community', description: 'Crowdsourced wisdom' },
]

/**
 * Renders the pricing page with plan selection, billing-cycle toggle, lifetime offer, feature pillars, FAQs, and CTAs.
 *
 * The component reads the current subscription tier, shows plan cards for available tiers, and initiates checkout or redirects to sign-up when a plan is selected. It also displays a lifetime purchase option and reflects loading and current-plan states in the UI.
 *
 * @returns The pricing page UI as a JSX element.
 */

export function PricingPage() {
  const [cycle, setCycle] = useState<BillingCycle>('annual')
  const [loadingTier, setLoadingTier] = useState<string | null>(null)
  const { user } = useAuthStore()

  const { data: subscriptionData } = useQuery({
    queryKey: ['user', 'subscription'],
    queryFn: () => api.user.subscription(),
    enabled: !!user,
    staleTime: 60_000,
  })

  const checkoutMutation = useMutation({
    mutationFn: (tier: PlanTier) => api.user.createCheckoutSession(tier, cycle),
    onMutate: (tier) => setLoadingTier(tier),
    onSuccess: (data) => {
      const url = (data as { url?: string })?.url
      if (url) window.location.href = url
    },
    onError: () => setLoadingTier(null),
    onSettled: () => setLoadingTier(null),
  })

  /**
   * Initiates selection of a subscription plan, redirecting unauthenticated users to sign-up.
   *
   * If no authenticated user is present, navigates the browser to "/sign-up". If `tier` is `'free'`, no action is taken. For other tiers, starts the checkout process for the given plan.
   *
   * @param tier - The plan tier to select
   */
  function handleSelectPlan(tier: PlanTier) {
    if (!user) {
      window.location.href = '/sign-up'
      return
    }
    if (tier === 'free') return
    checkoutMutation.mutate(tier)
  }

  const currentTier = ((subscriptionData as { tier?: string } | undefined)?.tier ??
    'free') as string

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-7xl space-y-20 px-6 py-16">
        {/* Hero */}
        <div className="space-y-4 text-center">
          <div className="bg-brand-900/40 border-brand-700/50 text-brand-300 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium">
            <Zap className="h-3 w-3" />
            SweepBot Intelligence Platform
          </div>
          <h1 className="text-4xl font-black tracking-tight lg:text-5xl">
            Know exactly what's happening
            <br />
            <span className="text-brand-400">with your sweepstakes data.</span>
          </h1>
          <p className="mx-auto max-w-2xl text-zinc-400">
            The Bloomberg Terminal of sweepstakes play. Track, automate, and analyze across 100+
            platforms. Start free, upgrade when you're ready.
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900 p-1">
            {(['monthly', 'annual'] as BillingCycle[]).map((c) => (
              <button
                key={c}
                onClick={() => setCycle(c)}
                className={cn(
                  'rounded-lg px-4 py-2 text-sm font-medium capitalize transition-colors',
                  cycle === c ? 'bg-brand-600 text-white' : 'text-zinc-400 hover:text-white'
                )}
              >
                {c}
                {c === 'annual' && (
                  <span className="ml-1.5 text-xs font-semibold text-green-400">Save 33%</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid items-start gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {PLANS.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              cycle={cycle}
              currentTier={currentTier}
              onSelect={handleSelectPlan}
              loading={loadingTier}
            />
          ))}
        </div>

        {/* Lifetime deal */}
        <div className="rounded-2xl border border-amber-800/40 bg-gradient-to-r from-amber-950/60 via-zinc-900 to-orange-950/60 p-8">
          <div className="flex flex-col items-center justify-between gap-6 lg:flex-row">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-600 to-orange-600">
                <Gift className="h-7 w-7 text-white" />
              </div>
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <h2 className="text-xl font-bold text-white">Lifetime Pro — $499</h2>
                  <span className="rounded-full bg-amber-700 px-2 py-0.5 text-xs font-bold text-white">
                    Limited Time
                  </span>
                </div>
                <p className="text-sm text-zinc-400">
                  Pay once, own SweepBot Pro forever. All future Pro updates included. No
                  subscription, no recurring charges. Community goes feral for these.
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  {LIFETIME_PLAN.features.map((f) => (
                    <span key={f} className="flex items-center gap-1 text-xs text-zinc-400">
                      <CheckCircle2 className="h-3 w-3 text-amber-500" />
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <button
              onClick={() => handleSelectPlan('lifetime')}
              disabled={loadingTier === 'lifetime' || currentTier === 'lifetime'}
              className="flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 px-8 py-3 text-sm font-bold text-white transition-all hover:from-amber-500 hover:to-orange-500 disabled:opacity-50"
            >
              {loadingTier === 'lifetime' && <Loader2 className="h-4 w-4 animate-spin" />}
              {currentTier === 'lifetime' ? 'You own it!' : 'Buy Lifetime — $499'}
            </button>
          </div>
        </div>

        {/* Feature pillars */}
        <div className="space-y-6">
          <h2 className="text-center text-2xl font-bold text-white">
            Everything you need, in one platform
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURE_PILLARS.map(({ icon: Icon, label, description }) => (
              <div
                key={label}
                className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4"
              >
                <div className="bg-brand-900/50 border-brand-800/50 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border">
                  <Icon className="w-4.5 h-4.5 text-brand-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{label}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Compliance notice */}
        <div className="mx-auto flex max-w-3xl items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 px-5 py-4">
          <Shield className="mt-0.5 h-4 w-4 flex-shrink-0 text-zinc-500" />
          <p className="text-xs leading-relaxed text-zinc-500">
            <span className="font-semibold text-zinc-400">Legal notice:</span> SweepBot is a
            data-tracking and transparency tool, not a gambling product or service. All analytics,
            RTP figures, and historical data shown are informational only and reflect your personal
            logged activity. SweepBot does not provide gambling advice, predict outcomes, recommend
            play strategies, or guarantee any particular results. Sweepstakes play involves no
            real-money wagers. Please play responsibly.
          </p>
        </div>

        {/* Social proof strip */}
        <div className="space-y-4 text-center">
          <p className="text-sm text-zinc-500">
            Trusted by sweepstakes grinders across 50+ platforms
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 opacity-60">
            {['Chumba Casino', 'Pulsz', 'Stake.us', 'WOW Vegas', 'Fortune Coins', 'McLuck'].map(
              (p) => (
                <span key={p} className="text-xs font-medium text-zinc-600">
                  {p}
                </span>
              )
            )}
          </div>
        </div>

        {/* FAQ */}
        <div className="mx-auto max-w-2xl space-y-2">
          <h2 className="mb-6 text-center text-2xl font-bold text-white">
            Frequently Asked Questions
          </h2>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-6">
            {FAQ.map((item) => (
              <FAQItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="from-brand-950 border-brand-800/40 space-y-4 rounded-2xl border bg-gradient-to-br to-zinc-900 p-12 text-center">
          <h2 className="text-3xl font-black text-white">
            Start tracking your data today.
            <br />
            <span className="text-brand-400">It's free.</span>
          </h2>
          <p className="mx-auto max-w-lg text-zinc-400">
            Every session you log is another data point working for you. Full transparency, zero
            guesswork.
          </p>
          <a
            href="/sign-up"
            className="bg-brand-600 hover:bg-brand-500 inline-flex items-center gap-2 rounded-xl px-8 py-3 text-sm font-bold text-white transition-colors"
          >
            <Zap className="h-4 w-4" />
            Create Free Account
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  )
}

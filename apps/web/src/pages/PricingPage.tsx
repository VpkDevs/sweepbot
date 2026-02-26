import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
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
    tagline: 'Data-driven edge over the house',
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
    tagline: 'Maximum intelligence, maximum edge',
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
  const isCurrentPlan = currentTier === plan.id
  const isUpgrade = !isCurrentPlan

  return (
    <div
      className={cn(
        'relative bg-zinc-900 rounded-2xl border p-6 flex flex-col',
        plan.highlighted ? 'border-brand-500 ring-2 ring-brand-500/20 scale-[1.02]' : 'border-zinc-800'
      )}
    >
      {plan.badge && (
        <div className={cn('absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-bold whitespace-nowrap', plan.badgeColor)}>
          {plan.badge}
        </div>
      )}

      <div className="mb-4">
        <h3 className="text-base font-bold text-white">{plan.name}</h3>
        <p className="text-xs text-zinc-500 mt-0.5">{plan.tagline}</p>
      </div>

      {/* Price */}
      <div className="mb-6">
        {price === 0 ? (
          <p className="text-3xl font-black text-white">Free</p>
        ) : price !== null ? (
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-white">
                ${cycle === 'annual' ? monthlyEquiv?.toFixed(2) : price}
              </span>
              <span className="text-sm text-zinc-500">/mo</span>
            </div>
            {cycle === 'annual' && (
              <p className="text-xs text-zinc-500 mt-0.5">
                Billed ${plan.priceAnnual} annually
                <span className="text-green-400 ml-1">
                  (save ${((plan.priceMonthly! * 12) - plan.priceAnnual!).toFixed(0)})
                </span>
              </p>
            )}
          </div>
        ) : null}
      </div>

      {/* Feature list */}
      <ul className="space-y-2 flex-1 mb-6">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-zinc-400">
            <CheckCircle2 className="w-4 h-4 text-brand-500 shrink-0 mt-0.5" />
            {f}
          </li>
        ))}
      </ul>

      {/* Limits summary */}
      <div className="grid grid-cols-3 gap-1 mb-6 text-center">
        {COMPARISON_ROWS.map(({ label, key }) => (
          <div key={key} className="bg-zinc-800/60 rounded-lg p-1.5">
            <p className="text-[9px] text-zinc-600 uppercase">{label}</p>
            <p className="text-xs font-semibold text-zinc-300 mt-0.5">
              {String(plan.limits[key])}
            </p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <button
        onClick={() => onSelect(plan.id)}
        disabled={isCurrentPlan || loading === plan.id}
        className={cn(
          'w-full py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2',
          isCurrentPlan
            ? 'bg-zinc-800 text-zinc-500 cursor-default'
            : plan.highlighted
            ? 'bg-brand-600 hover:bg-brand-500 text-white'
            : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white'
        )}
      >
        {loading === plan.id && <Loader2 className="w-4 h-4 animate-spin" />}
        {isCurrentPlan ? 'Current Plan' : plan.cta}
        {isUpgrade && !isCurrentPlan && loading !== plan.id && <ArrowRight className="w-4 h-4" />}
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
        className="w-full flex items-center justify-between py-4 text-left gap-4"
      >
        <p className="text-sm font-medium text-white">{q}</p>
        <span className={cn('text-zinc-500 text-lg leading-none transition-transform', open && 'rotate-180')}>
          ›
        </span>
      </button>
      {open && <p className="text-sm text-zinc-400 pb-4">{a}</p>}
    </div>
  )
}

// ─── Feature icons strip ──────────────────────────────────────────────────────

const FEATURE_PILLARS = [
  { icon: Zap, label: 'Automation Engine', description: 'Claim bonuses on autopilot' },
  { icon: BarChart2, label: 'Analytics Intelligence', description: 'Personal RTP & bonus tracking' },
  { icon: Shield, label: 'Trust Index', description: 'Know which platforms to trust' },
  { icon: Cpu, label: 'Jackpot Intelligence', description: 'Real-time progressive tracking' },
  { icon: Star, label: 'Game Database', description: 'Per-game RTP profiles' },
  { icon: Users, label: 'Community', description: 'Crowdsourced wisdom' },
]

// ─── Main Page ────────────────────────────────────────────────────────────────

export function PricingPage() {
  const [cycle, setCycle] = useState<BillingCycle>('annual')
  const [loadingTier, setLoadingTier] = useState<string | null>(null)
  const { user } = useAuthStore()

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

  function handleSelectPlan(tier: PlanTier) {
    if (!user) {
      window.location.href = '/sign-up'
      return
    }
    if (tier === 'free') return
    checkoutMutation.mutate(tier)
  }

  // TODO: get from user subscription query
  const currentTier = (user as Record<string, unknown> | null)?.['tier'] as string | null ?? 'free'

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-7xl mx-auto px-6 py-16 space-y-20">

        {/* Hero */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-900/40 border border-brand-700/50 text-brand-300 text-xs font-medium">
            <Zap className="w-3 h-3" />
            SweepBot Intelligence Platform
          </div>
          <h1 className="text-4xl lg:text-5xl font-black tracking-tight">
            Give yourself the edge
            <br />
            <span className="text-brand-400">the house never wants you to have.</span>
          </h1>
          <p className="text-zinc-400 max-w-2xl mx-auto">
            The Bloomberg Terminal of sweepstakes gambling. Track, automate, and analyze across 100+ platforms.
            Start free, upgrade when you're ready.
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
            {(['monthly', 'annual'] as BillingCycle[]).map((c) => (
              <button
                key={c}
                onClick={() => setCycle(c)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize',
                  cycle === c ? 'bg-brand-600 text-white' : 'text-zinc-400 hover:text-white'
                )}
              >
                {c}
                {c === 'annual' && (
                  <span className="ml-1.5 text-xs text-green-400 font-semibold">Save 33%</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 items-start">
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
        <div className="bg-gradient-to-r from-amber-950/60 via-zinc-900 to-orange-950/60 rounded-2xl border border-amber-800/40 p-8">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-600 to-orange-600 flex items-center justify-center shrink-0">
                <Gift className="w-7 h-7 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-bold text-white">Lifetime Pro — $499</h2>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-700 text-white font-bold">Limited Time</span>
                </div>
                <p className="text-sm text-zinc-400">
                  Pay once, own SweepBot Pro forever. All future Pro updates included.
                  No subscription, no recurring charges. Community goes feral for these.
                </p>
                <div className="flex flex-wrap gap-3 mt-3">
                  {LIFETIME_PLAN.features.map((f) => (
                    <span key={f} className="flex items-center gap-1 text-xs text-zinc-400">
                      <CheckCircle2 className="w-3 h-3 text-amber-500" />
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <button
              onClick={() => handleSelectPlan('lifetime')}
              disabled={loadingTier === 'lifetime' || currentTier === 'lifetime'}
              className="shrink-0 px-8 py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold rounded-xl transition-all disabled:opacity-50 flex items-center gap-2 text-sm"
            >
              {loadingTier === 'lifetime' && <Loader2 className="w-4 h-4 animate-spin" />}
              {currentTier === 'lifetime' ? 'You own it!' : 'Buy Lifetime — $499'}
            </button>
          </div>
        </div>

        {/* Feature pillars */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-center text-white">Everything you need, in one platform</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURE_PILLARS.map(({ icon: Icon, label, description }) => (
              <div key={label} className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-brand-900/50 border border-brand-800/50 flex items-center justify-center shrink-0">
                  <Icon className="w-4.5 h-4.5 text-brand-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{label}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Social proof strip */}
        <div className="text-center space-y-4">
          <p className="text-zinc-500 text-sm">Trusted by sweepstakes grinders across 50+ platforms</p>
          <div className="flex items-center justify-center gap-8 flex-wrap opacity-60">
            {['Chumba Casino', 'Pulsz', 'Stake.us', 'WOW Vegas', 'Fortune Coins', 'McLuck'].map((p) => (
              <span key={p} className="text-xs text-zinc-600 font-medium">{p}</span>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto space-y-2">
          <h2 className="text-2xl font-bold text-center text-white mb-6">Frequently Asked Questions</h2>
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 px-6">
            {FAQ.map((item) => (
              <FAQItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="bg-gradient-to-br from-brand-950 to-zinc-900 rounded-2xl border border-brand-800/40 p-12 text-center space-y-4">
          <h2 className="text-3xl font-black text-white">
            Start building your edge today.
            <br />
            <span className="text-brand-400">It's free.</span>
          </h2>
          <p className="text-zinc-400 max-w-lg mx-auto">
            Every day you track is a day of data the house doesn't have. Even free users are profitable users.
          </p>
          <a
            href="/sign-up"
            className="inline-flex items-center gap-2 px-8 py-3 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl transition-colors text-sm"
          >
            <Zap className="w-4 h-4" />
            Create Free Account
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>

      </div>
    </div>
  )
}

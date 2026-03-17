import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Award,
  Lock,
  Star,
  Trophy,
  Flame,
  Users,
  Zap,
  BarChart3,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import { api } from '../lib/api'
import { cn } from '../lib/utils'
import { ScrollReveal } from '../components/fx/ScrollReveal'
import { SpotlightCard } from '../components/fx/SpotlightCard'
import { TextReveal } from '../components/fx/TextReveal'

// ── Types ─────────────────────────────────────────────────────────────────────

type Achievement = {
  id: string
  key: string
  name: string
  description: string
  icon: string
  category: string
  tier: string
  points: number
  requirement: Record<string, unknown>
  is_secret: boolean
  earned_at: string | null
  progress: { current: number; required: number } | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { key: 'all', label: 'All', icon: Award },
  { key: 'sessions', label: 'Sessions', icon: BarChart3 },
  { key: 'bonuses', label: 'Bonuses', icon: Star },
  { key: 'jackpots', label: 'Jackpots', icon: Trophy },
  { key: 'streaks', label: 'Streaks', icon: Flame },
  { key: 'social', label: 'Social', icon: Users },
  { key: 'flows', label: 'Flows', icon: Zap },
] as const

const TIER_STYLES = {
  bronze: {
    bg: 'bg-amber-500/5',
    border: 'border-amber-700/20',
    badge:
      'bg-gradient-to-r from-amber-600/20 to-amber-500/10 text-amber-300 ring-1 ring-amber-500/20',
    label: 'Bronze',
    glow: 'shadow-amber-500/5',
    accent: 'from-amber-600 to-amber-400',
    progressBg: 'from-amber-600 to-amber-400',
  },
  silver: {
    bg: 'bg-zinc-500/5',
    border: 'border-zinc-600/20',
    badge: 'bg-gradient-to-r from-zinc-500/20 to-zinc-400/10 text-zinc-300 ring-1 ring-zinc-500/20',
    label: 'Silver',
    glow: 'shadow-zinc-400/5',
    accent: 'from-zinc-400 to-zinc-300',
    progressBg: 'from-zinc-500 to-zinc-300',
  },
  gold: {
    bg: 'bg-yellow-500/5',
    border: 'border-yellow-600/20',
    badge:
      'bg-gradient-to-r from-yellow-600/20 to-yellow-500/10 text-yellow-300 ring-1 ring-yellow-500/20',
    label: 'Gold',
    glow: 'shadow-yellow-500/10',
    accent: 'from-yellow-500 to-yellow-300',
    progressBg: 'from-yellow-600 to-yellow-400',
  },
  platinum: {
    bg: 'bg-violet-500/5',
    border: 'border-violet-600/20',
    badge:
      'bg-gradient-to-r from-violet-600/20 to-violet-500/10 text-violet-300 ring-1 ring-violet-500/20',
    label: 'Platinum',
    glow: 'shadow-violet-500/10',
    accent: 'from-violet-500 to-violet-300',
    progressBg: 'from-violet-600 to-violet-400',
  },
} as const

function widthClass(percent: number) {
  const rounded = Math.max(0, Math.min(100, Math.round(percent / 5) * 5))
  return `score-width-${rounded}`
}

/**
 * Renders the Achievements page with category filtering, tier summaries, and a refresh action.
 *
 * Displays earned counts, total points, a per-tier summary, category tabs, and a responsive grid of achievement cards.
 *
 * @returns The page's JSX element that presents the achievements UI, including controls for refreshing and filtering.
 */

export function AchievementsPage() {
  const [activeCategory, setActiveCategory] = useState('all')
  const queryClient = useQueryClient()

  const { data = [], isLoading } = useQuery({
    queryKey: ['features', 'achievements', activeCategory],
    queryFn: () =>
      api.features.achievements(
        activeCategory !== 'all' ? { category: activeCategory } : undefined
      ),
  })

  const achievements = data as Achievement[]

  const checkMutation = useMutation({
    mutationFn: () => api.features.checkAchievements(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['features', 'achievements'] }),
  })

  if (isLoading) return <AchievementsSkeleton />

  const earned = achievements.filter((a) => a.earned_at !== null)
  const totalPoints = earned.reduce((sum, a) => sum + a.points, 0)

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6 lg:p-8">
      {/* Header */}
      <ScrollReveal>
        <div className="flex items-center justify-between">
          <div>
            <TextReveal as="h1" className="heading-display text-shimmer text-white" stagger={50}>
              Achievements
            </TextReveal>
            <p className="mt-1.5 text-sm text-zinc-500">
              <span className="text-brand-400 font-semibold">{earned.length}</span> of{' '}
              {achievements.length} unlocked ·{' '}
              <span className="font-semibold text-white">{totalPoints.toLocaleString()}</span>{' '}
              points
            </p>
          </div>
          <button
            onClick={() => checkMutation.mutate()}
            disabled={checkMutation.isPending}
            className="glass-card press-scale flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-zinc-300 transition-all hover:bg-white/[0.06] disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', checkMutation.isPending && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </ScrollReveal>

      {/* Tier summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(['bronze', 'silver', 'gold', 'platinum'] as const).map((tier, i) => {
          const tierAch = achievements.filter((a) => a.tier === tier)
          const tierEarned = tierAch.filter((a) => a.earned_at !== null)
          const styles = TIER_STYLES[tier]
          const pct = tierAch.length > 0 ? (tierEarned.length / tierAch.length) * 100 : 0
          return (
            <ScrollReveal key={tier} delay={i * 60}>
              <SpotlightCard className={cn('glass-card rounded-2xl p-4', styles.glow)}>
                <div className="mb-2 flex items-center justify-between">
                  <span className={cn('rounded-lg px-2.5 py-0.5 text-xs font-bold', styles.badge)}>
                    {styles.label}
                  </span>
                  <span className="text-xs font-medium tabular-nums text-zinc-600">
                    {Math.round(pct)}%
                  </span>
                </div>
                <p className="text-2xl font-bold tabular-nums tracking-tight text-white">
                  {tierEarned.length}
                  <span className="text-sm font-normal text-zinc-600">/{tierAch.length}</span>
                </p>
                <div className="progress-bar-container mt-2">
                  <div
                    className={cn(
                      'progress-bar-fill bg-gradient-to-r',
                      styles.progressBg,
                      widthClass(pct)
                    )}
                  />
                </div>
              </SpotlightCard>
            </ScrollReveal>
          )
        })}
      </div>

      {/* Category tabs */}
      <div className="glass-card-static animate-reveal-up flex w-fit gap-1 overflow-x-auto rounded-xl p-1 pb-1 [animation-delay:240ms]">
        {CATEGORIES.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveCategory(key)}
            className={cn(
              'press-scale flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-all',
              activeCategory === key
                ? 'bg-brand-600/20 text-brand-300 ring-brand-500/20 shadow-sm ring-1'
                : 'text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {achievements.length === 0 ? (
        <div className="animate-reveal-up flex flex-col items-center justify-center py-24 text-center">
          <div className="empty-icon-wrapper bg-brand-500/10 mb-4 flex h-16 w-16 items-center justify-center rounded-2xl">
            <Award className="h-8 w-8 text-zinc-600" />
          </div>
          <p className="text-zinc-500">No achievements in this category yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {achievements.map((a, i) => (
            <ScrollReveal key={a.id} delay={i * 40}>
              <AchievementCard achievement={a} />
            </ScrollReveal>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Render a card that displays an achievement's tier, icon, name, description, progress, and footer metadata.
 *
 * @param achievement - The achievement to display; its `tier`, `is_secret`, `earned_at`, `progress`, `points`, `icon`, `name`, and `description` fields determine the card's appearance and content.
 * @returns A React element representing the styled achievement card.
 */

function AchievementCard({ achievement: a }: { achievement: Achievement }) {
  const isEarned = a.earned_at !== null
  const styles = TIER_STYLES[a.tier as keyof typeof TIER_STYLES] ?? TIER_STYLES.bronze
  const progress = a.progress

  return (
    <div
      className={cn(
        'glass-card relative rounded-2xl p-4 transition-all',
        isEarned ? cn('shine-on-hover card-tilt', styles.glow) : 'opacity-50 hover:opacity-70'
      )}
    >
      {/* Tier badge */}
      <span
        className={cn(
          'absolute right-3 top-3 rounded-lg px-2 py-0.5 text-[10px] font-bold',
          styles.badge
        )}
      >
        {styles.label}
      </span>

      {/* Icon + name */}
      <div className="mb-2 flex items-start gap-3 pr-16">
        <span className={cn('text-3xl', !isEarned && 'opacity-50 grayscale')}>
          {a.is_secret && !isEarned ? '🔒' : a.icon}
        </span>
        <div>
          <p className={cn('text-sm font-semibold', isEarned ? 'text-white' : 'text-zinc-500')}>
            {a.is_secret && !isEarned ? '???' : a.name}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
            {a.is_secret && !isEarned
              ? 'Complete something special to reveal this achievement.'
              : a.description}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      {!isEarned && progress && (
        <div className="mt-3">
          <div className="mb-1.5 flex justify-between text-xs text-zinc-600">
            <span className="font-medium">Progress</span>
            <span className="font-semibold tabular-nums">
              {progress.current} / {progress.required}
            </span>
          </div>
          <div className="progress-bar-container">
            <div
              className={cn(
                'progress-bar-fill bg-gradient-to-r',
                styles.progressBg,
                widthClass(Math.min((progress.current / progress.required) * 100, 100))
              )}
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between border-t border-white/[0.04] pt-2">
        <span className="text-xs font-semibold tabular-nums text-zinc-600">+{a.points} pts</span>
        {isEarned && a.earned_at ? (
          <span className="text-xs tabular-nums text-zinc-600">
            {new Date(a.earned_at).toLocaleDateString('en', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        ) : (
          <Lock className="h-3 w-3 text-zinc-700" />
        )}
      </div>
    </div>
  )
}

/**
 * Visual skeleton placeholder displayed while achievements data is loading.
 *
 * @returns The skeleton UI element containing placeholder header, category chips, and achievement card placeholders
 */

function AchievementsSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6 lg:p-8">
      <div className="skeleton-text h-8 w-48 rounded-lg" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass-card shimmer h-28 rounded-2xl" />
        ))}
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="shimmer h-8 w-24 rounded-xl bg-zinc-800/30" />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="glass-card shimmer h-44 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}

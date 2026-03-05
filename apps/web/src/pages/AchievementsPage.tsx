import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Award, Lock, Star, Trophy, Flame, Users, Zap, BarChart3, RefreshCw, Sparkles } from 'lucide-react'
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
  bronze:   {
    bg: 'bg-amber-500/5', border: 'border-amber-700/20',
    badge: 'bg-gradient-to-r from-amber-600/20 to-amber-500/10 text-amber-300 ring-1 ring-amber-500/20',
    label: 'Bronze', glow: 'shadow-amber-500/5', accent: 'from-amber-600 to-amber-400',
    progressBg: 'from-amber-600 to-amber-400',
  },
  silver:   {
    bg: 'bg-zinc-500/5', border: 'border-zinc-600/20',
    badge: 'bg-gradient-to-r from-zinc-500/20 to-zinc-400/10 text-zinc-300 ring-1 ring-zinc-500/20',
    label: 'Silver', glow: 'shadow-zinc-400/5', accent: 'from-zinc-400 to-zinc-300',
    progressBg: 'from-zinc-500 to-zinc-300',
  },
  gold:     {
    bg: 'bg-yellow-500/5', border: 'border-yellow-600/20',
    badge: 'bg-gradient-to-r from-yellow-600/20 to-yellow-500/10 text-yellow-300 ring-1 ring-yellow-500/20',
    label: 'Gold', glow: 'shadow-yellow-500/10', accent: 'from-yellow-500 to-yellow-300',
    progressBg: 'from-yellow-600 to-yellow-400',
  },
  platinum: {
    bg: 'bg-violet-500/5', border: 'border-violet-600/20',
    badge: 'bg-gradient-to-r from-violet-600/20 to-violet-500/10 text-violet-300 ring-1 ring-violet-500/20',
    label: 'Platinum', glow: 'shadow-violet-500/10', accent: 'from-violet-500 to-violet-300',
    progressBg: 'from-violet-600 to-violet-400',
  },
} as const

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
      api.features.achievements(activeCategory !== 'all' ? { category: activeCategory } : undefined),
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
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <ScrollReveal>
      <div className="flex items-center justify-between">
        <div>
          <TextReveal as="h1" className="heading-display text-white text-shimmer" stagger={50}>Achievements</TextReveal>
          <p className="text-zinc-500 text-sm mt-1.5">
            <span className="text-brand-400 font-semibold">{earned.length}</span> of {achievements.length} unlocked ·{' '}
            <span className="text-white font-semibold">{totalPoints.toLocaleString()}</span> points
          </p>
        </div>
        <button
          onClick={() => checkMutation.mutate()}
          disabled={checkMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-xl glass-card text-zinc-300 text-sm font-medium transition-all hover:bg-white/[0.06] disabled:opacity-50 press-scale"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', checkMutation.isPending && 'animate-spin')} />
          Refresh
        </button>
      </div>
      </ScrollReveal>

      {/* Tier summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(['bronze', 'silver', 'gold', 'platinum'] as const).map((tier, i) => {
          const tierAch = achievements.filter((a) => a.tier === tier)
          const tierEarned = tierAch.filter((a) => a.earned_at !== null)
          const styles = TIER_STYLES[tier]
          const pct = tierAch.length > 0 ? (tierEarned.length / tierAch.length) * 100 : 0
          return (
            <ScrollReveal key={tier} delay={i * 60}>
            <SpotlightCard className={cn('glass-card rounded-2xl p-4', styles.glow)}>
              <div className="flex items-center justify-between mb-2">
                <span className={cn('px-2.5 py-0.5 rounded-lg text-xs font-bold', styles.badge)}>
                  {styles.label}
                </span>
                <span className="text-xs text-zinc-600 tabular-nums font-medium">{Math.round(pct)}%</span>
              </div>
              <p className="text-2xl font-bold text-white tabular-nums tracking-tight">
                {tierEarned.length}
                <span className="text-zinc-600 text-sm font-normal">/{tierAch.length}</span>
              </p>
              <div className="progress-bar-container mt-2">
                <div
                  className={cn('progress-bar-fill bg-gradient-to-r', styles.progressBg)}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </SpotlightCard>
            </ScrollReveal>
          )
        })}
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 glass-card-static rounded-xl p-1 w-fit animate-reveal-up" style={{ animationDelay: '240ms' }}>
        {CATEGORIES.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveCategory(key)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all press-scale',
              activeCategory === key
                ? 'bg-brand-600/20 text-brand-300 ring-1 ring-brand-500/20 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]',
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {achievements.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center animate-reveal-up">
          <div className="empty-icon-wrapper w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mb-4">
            <Award className="w-8 h-8 text-zinc-600" />
          </div>
          <p className="text-zinc-500">No achievements in this category yet.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
        'glass-card rounded-2xl p-4 relative transition-all',
        isEarned ? cn('shine-on-hover card-tilt', styles.glow) : 'opacity-50 hover:opacity-70',
      )}
    >
      {/* Tier badge */}
      <span className={cn('absolute top-3 right-3 text-[10px] px-2 py-0.5 rounded-lg font-bold', styles.badge)}>
        {styles.label}
      </span>

      {/* Icon + name */}
      <div className="flex items-start gap-3 mb-2 pr-16">
        <span className={cn('text-3xl', !isEarned && 'grayscale opacity-50')}>
          {a.is_secret && !isEarned ? '🔒' : a.icon}
        </span>
        <div>
          <p className={cn('font-semibold text-sm', isEarned ? 'text-white' : 'text-zinc-500')}>
            {a.is_secret && !isEarned ? '???' : a.name}
          </p>
          <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
            {a.is_secret && !isEarned
              ? 'Complete something special to reveal this achievement.'
              : a.description}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      {!isEarned && progress && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-zinc-600 mb-1.5">
            <span className="font-medium">Progress</span>
            <span className="tabular-nums font-semibold">
              {progress.current} / {progress.required}
            </span>
          </div>
          <div className="progress-bar-container">
            <div
              className={cn('progress-bar-fill bg-gradient-to-r', styles.progressBg)}
              style={{ width: `${Math.min((progress.current / progress.required) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/[0.04]">
        <span className="text-xs text-zinc-600 font-semibold tabular-nums">+{a.points} pts</span>
        {isEarned && a.earned_at ? (
          <span className="text-xs text-zinc-600 tabular-nums">
            {new Date(a.earned_at).toLocaleDateString('en', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        ) : (
          <Lock className="w-3 h-3 text-zinc-700" />
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
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      <div className="h-8 w-48 skeleton-text rounded-lg" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass-card rounded-2xl h-28 shimmer" />
        ))}
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-8 w-24 bg-zinc-800/30 rounded-xl shimmer" />
        ))}
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="glass-card rounded-2xl h-44 shimmer" />
        ))}
      </div>
    </div>
  )
}

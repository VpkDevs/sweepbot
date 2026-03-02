import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Award, Lock, Star, Trophy, Flame, Users, Zap, BarChart3 } from 'lucide-react'
import { api } from '../lib/api'
import { cn } from '../lib/utils'

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
  bronze:   { bg: 'bg-amber-900/20',  border: 'border-amber-800/40',  badge: 'bg-amber-900/60 text-amber-300',   label: 'Bronze' },
  silver:   { bg: 'bg-zinc-700/20',   border: 'border-zinc-600/40',   badge: 'bg-zinc-700/60 text-zinc-300',     label: 'Silver' },
  gold:     { bg: 'bg-yellow-900/20', border: 'border-yellow-700/40', badge: 'bg-yellow-900/60 text-yellow-300', label: 'Gold' },
  platinum: { bg: 'bg-violet-900/20', border: 'border-violet-700/40', badge: 'bg-violet-900/60 text-violet-300', label: 'Platinum' },
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
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Achievements</h1>
          <p className="text-zinc-400 text-sm mt-1">
            {earned.length} of {achievements.length} unlocked · {totalPoints.toLocaleString()} points
          </p>
        </div>
        <button
          onClick={() => checkMutation.mutate()}
          disabled={checkMutation.isPending}
          className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors disabled:opacity-50"
        >
          {checkMutation.isPending ? 'Checking...' : 'Refresh'}
        </button>
      </div>

      {/* Tier summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(['bronze', 'silver', 'gold', 'platinum'] as const).map((tier) => {
          const tierAch = achievements.filter((a) => a.tier === tier)
          const tierEarned = tierAch.filter((a) => a.earned_at !== null)
          const styles = TIER_STYLES[tier]
          return (
            <div key={tier} className={cn('rounded-xl border p-3', styles.bg, styles.border)}>
              <p className="text-xs text-zinc-500 mb-1">{styles.label}</p>
              <p className="text-lg font-bold text-white tabular-nums">
                {tierEarned.length}
                <span className="text-zinc-500 text-sm font-normal">/{tierAch.length}</span>
              </p>
            </div>
          )
        })}
      </div>

      {/* Category tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {CATEGORIES.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveCategory(key)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
              activeCategory === key
                ? 'bg-brand-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300',
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {achievements.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Award className="w-12 h-12 text-zinc-700 mb-4" />
          <p className="text-zinc-400">No achievements in this category yet.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {achievements.map((a) => (
            <AchievementCard key={a.id} achievement={a} />
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
        'rounded-xl border p-4 relative transition-all',
        isEarned ? cn(styles.bg, styles.border) : 'bg-zinc-900 border-zinc-800 opacity-60',
      )}
    >
      {/* Tier badge */}
      <span className={cn('absolute top-3 right-3 text-xs px-1.5 py-0.5 rounded font-medium', styles.badge)}>
        {styles.label}
      </span>

      {/* Icon + name */}
      <div className="flex items-start gap-3 mb-2 pr-14">
        <span className={cn('text-3xl', !isEarned && 'grayscale')}>
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
          <div className="flex justify-between text-xs text-zinc-500 mb-1">
            <span>Progress</span>
            <span>
              {progress.current} / {progress.required}
            </span>
          </div>
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-500 rounded-full transition-all"
              style={{ width: `${Math.min((progress.current / progress.required) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-3">
        <span className="text-xs text-zinc-500 font-medium">+{a.points} pts</span>
        {isEarned && a.earned_at ? (
          <span className="text-xs text-zinc-600">
            {new Date(a.earned_at).toLocaleDateString('en', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        ) : (
          <Lock className="w-3 h-3 text-zinc-600" />
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
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-pulse">
      <div className="h-8 w-48 bg-zinc-800 rounded" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 bg-zinc-900 rounded-xl border border-zinc-800" />
        ))}
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-8 w-24 bg-zinc-800 rounded-lg" />
        ))}
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="h-36 bg-zinc-900 rounded-xl border border-zinc-800" />
        ))}
      </div>
    </div>
  )
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trophy, TrendingUp, Star, Flame, Zap, Target, Award, RefreshCw } from 'lucide-react'
import { api } from '../lib/api'
import { formatSC, cn } from '../lib/utils'
import { ScrollReveal } from '../components/fx/ScrollReveal'
import { SpotlightCard } from '../components/fx/SpotlightCard'
import { TextReveal } from '../components/fx/TextReveal'

// ── Types ─────────────────────────────────────────────────────────────────────

type PersonalRecords = {
  biggest_single_win: number | null
  biggest_win_date: string | null
  biggest_win_game: string | null
  biggest_win_platform: string | null
  longest_win_streak: number
  current_win_streak: number
  longest_loss_streak: number
  current_loss_streak: number
  best_rtp_session: number | null
  best_rtp_min_bets: number
  highest_balance: number | null
  most_bonuses_single_day: number
  total_jackpots_hit: number
  biggest_jackpot: number | null
  last_computed_at: string | null
}

/**
 * Render the Personal Records dashboard with a refresh control, loading skeleton, and empty-state.
 *
 * Displays a header with optional last-updated timestamp, a "Recalculate" button that triggers a records refresh,
 * a skeleton while data is loading, a friendly empty-state when no records exist, and a grid of record cards when data is available.
 *
 * @returns A React element showing the user's personal records UI including header, refresh control, loading state, empty state, and records grid.
 */

export function RecordsPage() {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['features', 'records'],
    queryFn: () => api.features.records(),
  })

  const refreshMutation = useMutation({
    mutationFn: () => api.features.refreshRecords(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['features', 'records'] }),
  })

  if (isLoading) return <RecordsSkeleton />

  const records = data as PersonalRecords | null

  if (!records) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center animate-reveal-up">
        <div className="empty-icon-wrapper w-20 h-20 rounded-2xl bg-brand-500/10 flex items-center justify-center mb-5">
          <Trophy className="w-9 h-9 text-brand-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">No Records Yet</h2>
        <p className="text-zinc-500 text-sm max-w-sm text-pretty">
          Start logging sessions to build your personal record book.
        </p>
      </div>
    )
  }

  const recordCards = [
    {
      label: 'Biggest Single Win',
      value: records.biggest_single_win != null ? `${formatSC(records.biggest_single_win)} SC` : '\u2014',
      sub: [records.biggest_win_game, records.biggest_win_platform].filter(Boolean).join(' \u00b7 ') || undefined,
      date: records.biggest_win_date,
      icon: Trophy,
      color: 'text-jackpot',
      glow: 'shadow-yellow-500/10',
      highlight: true,
    },
    {
      label: 'Longest Win Streak',
      value: `${records.longest_win_streak} sessions`,
      sub:
        records.current_win_streak > 0
          ? `Currently on a ${records.current_win_streak}-session win streak`
          : undefined,
      icon: Flame,
      color: 'text-emerald-400',
      glow: 'shadow-emerald-500/10',
    },
    {
      label: 'Best RTP Session',
      value: records.best_rtp_session != null
        ? `${(Number(records.best_rtp_session) * 100).toFixed(1)}%`
        : '\u2014',
      sub: `Min. ${records.best_rtp_min_bets} bets to qualify`,
      icon: TrendingUp,
      color: 'text-brand-400',
      glow: 'shadow-brand-500/10',
    },
    {
      label: 'Highest Balance Reached',
      value: records.highest_balance != null ? `${formatSC(records.highest_balance)} SC` : '\u2014',
      icon: Star,
      color: 'text-yellow-400',
      glow: 'shadow-yellow-500/10',
    },
    {
      label: 'Most Bonuses in a Day',
      value: `${records.most_bonuses_single_day}`,
      sub: 'bonuses in one day',
      icon: Zap,
      color: 'text-violet-400',
      glow: 'shadow-violet-500/10',
    },
    {
      label: 'Total Jackpots Hit',
      value: `${records.total_jackpots_hit}`,
      sub:
        records.biggest_jackpot != null
          ? `Biggest: ${formatSC(records.biggest_jackpot)} SC`
          : undefined,
      icon: Award,
      color: 'text-jackpot',
      glow: 'shadow-yellow-500/10',
    },
    {
      label: 'Longest Loss Streak',
      value: `${records.longest_loss_streak} sessions`,
      sub:
        records.current_loss_streak > 0
          ? `Currently on a ${records.current_loss_streak}-session loss streak`
          : undefined,
      icon: Target,
      color: 'text-red-400',
      glow: 'shadow-red-500/10',
    },
  ]

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <ScrollReveal>
      <div className="flex items-center justify-between">
        <div>
          <TextReveal as="h1" className="heading-display text-white text-shimmer" stagger={50}>Personal Records</TextReveal>
          {records.last_computed_at && (
            <p className="text-zinc-600 text-xs mt-1.5 tabular-nums">
              Last updated{' '}
              {new Date(records.last_computed_at).toLocaleDateString('en', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          )}
        </div>
        <button
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-xl glass-card text-zinc-300 text-sm font-medium transition-all hover:bg-white/[0.06] disabled:opacity-50 press-scale"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', refreshMutation.isPending && 'animate-spin')} />
          Recalculate
        </button>
      </div>
      </ScrollReveal>

      {/* Records grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {recordCards.map((card, i) => (
          <ScrollReveal key={card.label} delay={i * 60}>
            <RecordCard {...card} />
          </ScrollReveal>
        ))}
      </div>
    </div>
  )
}

/**
 * Renders a styled card showing a single personal-record metric with optional subtitle and date.
 *
 * @param label - Uppercase short label displayed above the value
 * @param value - Primary value text to display; a placeholder like `—` is rendered with muted styling
 * @param sub - Optional secondary line of descriptive text shown beneath the value
 * @param date - Optional ISO date string (or null); when present it is shown as a short, localized date
 * @param icon - React component used as the card icon
 * @param color - CSS class(es) applied to the icon to control its color
 * @param highlight - When true, renders a highlighted border to draw attention to the card
 * @returns A React element representing the record card
 */

function RecordCard({
  label,
  value,
  sub,
  date,
  icon: Icon,
  color,
  glow,
  highlight = false,
}: {
  label: string
  value: string
  sub?: string
  date?: string | null
  icon: React.ElementType
  color: string
  glow?: string
  highlight?: boolean
}) {
  return (
    <SpotlightCard
      className={cn(
        'glass-card rounded-2xl p-5 space-y-3',
        highlight && 'gradient-border-gold holo-surface',
        glow,
      )}
    >
      <div className="flex items-center gap-2.5">
        <div className={cn('flex items-center justify-center w-8 h-8 rounded-xl bg-white/[0.04]', color)}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-[10px] text-zinc-500 uppercase tracking-[0.15em] font-bold">{label}</span>
      </div>
      <p className={cn('text-2xl font-bold tabular-nums tracking-tight', value === '\u2014' ? 'text-zinc-700' : 'text-white')}>
        {value}
      </p>
      {sub && <p className="text-xs text-zinc-500 leading-relaxed">{sub}</p>}
      {date && (
        <p className="text-xs text-zinc-600 tabular-nums">
          {new Date(date).toLocaleDateString('en', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>
      )}
    </SpotlightCard>
  )
}

/**
 * Render a placeholder skeleton for the Personal Records page while data is loading.
 *
 * @returns A React element containing the animated skeleton layout used as a loading placeholder for the records grid and header.
 */

function RecordsSkeleton() {
  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-6xl mx-auto">
      <div className="h-8 w-48 skeleton-text rounded-lg" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="glass-card rounded-2xl h-40 shimmer" />
        ))}
      </div>
    </div>
  )
}

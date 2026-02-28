import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trophy, TrendingUp, Star, Flame, Zap, Target, Award, RefreshCw } from 'lucide-react'
import { api } from '../lib/api'
import { formatSC, cn } from '../lib/utils'

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

// ── Page ──────────────────────────────────────────────────────────────────────

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
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Trophy className="w-12 h-12 text-zinc-700 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">No Records Yet</h2>
        <p className="text-zinc-400 text-sm max-w-sm">
          Start logging sessions to build your personal record book.
        </p>
      </div>
    )
  }

  const recordCards = [
    {
      label: 'Biggest Single Win',
      value: records.biggest_single_win != null ? `${formatSC(records.biggest_single_win)} SC` : '—',
      sub: [records.biggest_win_game, records.biggest_win_platform].filter(Boolean).join(' · ') || undefined,
      date: records.biggest_win_date,
      icon: Trophy,
      color: 'text-jackpot',
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
    },
    {
      label: 'Best RTP Session',
      value: records.best_rtp_session != null
        ? `${(Number(records.best_rtp_session) * 100).toFixed(1)}%`
        : '—',
      sub: `Min. ${records.best_rtp_min_bets} bets to qualify`,
      icon: TrendingUp,
      color: 'text-brand-400',
    },
    {
      label: 'Highest Balance Reached',
      value: records.highest_balance != null ? `${formatSC(records.highest_balance)} SC` : '—',
      icon: Star,
      color: 'text-yellow-400',
    },
    {
      label: 'Most Bonuses in a Day',
      value: `${records.most_bonuses_single_day}`,
      sub: 'bonuses in one day',
      icon: Zap,
      color: 'text-violet-400',
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
    },
  ]

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Personal Records</h1>
          {records.last_computed_at && (
            <p className="text-zinc-500 text-xs mt-1">
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
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', refreshMutation.isPending && 'animate-spin')} />
          Recalculate
        </button>
      </div>

      {/* Records grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {recordCards.map((card) => (
          <RecordCard key={card.label} {...card} />
        ))}
      </div>
    </div>
  )
}

// ── Record Card ───────────────────────────────────────────────────────────────

function RecordCard({
  label,
  value,
  sub,
  date,
  icon: Icon,
  color,
  highlight = false,
}: {
  label: string
  value: string
  sub?: string
  date?: string | null
  icon: React.ElementType
  color: string
  highlight?: boolean
}) {
  return (
    <div
      className={cn(
        'bg-zinc-900 rounded-xl border p-5 space-y-3',
        highlight ? 'border-yellow-700/40' : 'border-zinc-800',
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className={cn('w-4 h-4', color)} />
        <span className="text-xs text-zinc-500 uppercase tracking-wide font-medium">{label}</span>
      </div>
      <p className={cn('text-2xl font-bold tabular-nums', value === '—' ? 'text-zinc-600' : 'text-white')}>
        {value}
      </p>
      {sub && <p className="text-xs text-zinc-500">{sub}</p>}
      {date && (
        <p className="text-xs text-zinc-600">
          {new Date(date).toLocaleDateString('en', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>
      )}
    </div>
  )
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function RecordsSkeleton() {
  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto animate-pulse">
      <div className="h-8 w-48 bg-zinc-800 rounded" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-32 bg-zinc-900 rounded-xl border border-zinc-800" />
        ))}
      </div>
    </div>
  )
}

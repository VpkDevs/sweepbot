import { useQuery } from '@tanstack/react-query'
import { Flame, Trophy } from 'lucide-react'
import { api } from '../lib/api'
import { cn } from '../lib/utils'
import { ScrollReveal } from '../components/fx/ScrollReveal'
import { TextReveal } from '../components/fx/TextReveal'

interface LeaderboardEntry {
  rank: number
  user_id: string
  display_name: string | null
  current_streak: number
  longest_streak: number
}

const RANK_STYLES: Record<number, string> = {
  1: 'text-yellow-400 bg-yellow-500/10 ring-yellow-500/25',
  2: 'text-zinc-300 bg-zinc-500/10 ring-zinc-500/25',
  3: 'text-amber-500 bg-amber-700/10 ring-amber-700/25',
}

function RankBadge({ rank }: { rank: number }) {
  const style = RANK_STYLES[rank]
  if (style) {
    return (
      <span
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center text-sm font-black ring-1 flex-shrink-0',
          style,
        )}
      >
        {rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}
      </span>
    )
  }
  return (
    <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-zinc-500 ring-1 ring-zinc-700/40 flex-shrink-0 tabular-nums">
      {rank}
    </span>
  )
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <div className="w-8 h-8 rounded-full shimmer flex-shrink-0" />
      <div className="flex-1 h-4 rounded shimmer" />
      <div className="w-16 h-4 rounded shimmer" />
      <div className="w-16 h-4 rounded shimmer" />
    </div>
  )
}

/**
 * Opt-in streak leaderboard page showing top players' current and longest streaks.
 */
export function StreakLeaderboard() {
  const { data: rawEntries, isLoading } = useQuery({
    queryKey: ['streaks', 'leaderboard'],
    queryFn: () => api.streaks.leaderboard(50),
  })

  // Add rank index to each entry
  const entries: LeaderboardEntry[] = (rawEntries ?? []).map((e, i) => ({
    rank: i + 1,
    user_id: e.user_id,
    display_name: e.display_name,
    current_streak: e.current_streak,
    longest_streak: e.longest_streak,
  }))

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-3xl mx-auto">
      {/* Header */}
      <ScrollReveal>
        <div className="space-y-1">
          <TextReveal as="h1" className="heading-display text-3xl text-white text-shimmer" stagger={50}>
            🔥 Streak Leaderboard
          </TextReveal>
          <p className="text-zinc-500 text-sm">
            Opt-in leaderboard — only players who have enabled sharing appear here.
          </p>
        </div>
      </ScrollReveal>

      {/* Table card */}
      <ScrollReveal delay={100}>
        <div className="glass-card rounded-2xl overflow-hidden">
          {/* Column headers */}
          <div className="flex items-center gap-4 px-4 py-2.5 border-b border-white/[0.04] text-[10px] text-zinc-600 font-bold uppercase tracking-[0.15em]">
            <span className="w-8 flex-shrink-0 text-center">#</span>
            <span className="flex-1">Player</span>
            <span className="w-24 text-right">Current</span>
            <span className="w-24 text-right">Longest</span>
          </div>

          {/* Rows */}
          {isLoading ? (
            <div className="divide-y divide-white/[0.03]">
              {Array.from({ length: 10 }).map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-sm">
              <Trophy className="w-8 h-8 mx-auto mb-3 text-zinc-700" />
              <p>No entries yet. Be the first on the board!</p>
            </div>
          ) : (
            <ul className="divide-y divide-white/[0.03]">
              {entries.map((entry) => {
                const isTop3 = entry.rank <= 3
                return (
                  <li
                    key={entry.user_id}
                    className={cn(
                      'flex items-center gap-4 px-4 py-3 transition-colors hover:bg-white/[0.02]',
                      isTop3 && 'bg-white/[0.01]',
                    )}
                  >
                    <RankBadge rank={entry.rank} />

                    <span
                      className={cn(
                        'flex-1 text-sm font-medium truncate',
                        isTop3 ? 'text-white' : 'text-zinc-300',
                      )}
                    >
                      {entry.display_name ?? 'Anonymous'}
                    </span>

                    {/* Current streak */}
                    <span
                      className={cn(
                        'w-24 text-right flex items-center justify-end gap-1 tabular-nums text-sm font-bold',
                        entry.current_streak >= 7 ? 'text-orange-400' : 'text-zinc-300',
                      )}
                    >
                      <Flame className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
                      {entry.current_streak}d
                    </span>

                    {/* Longest streak */}
                    <span className="w-24 text-right tabular-nums text-sm text-zinc-500 font-medium">
                      {entry.longest_streak}d best
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </ScrollReveal>

      {/* Privacy note */}
      <ScrollReveal delay={200}>
        <p className="text-xs text-zinc-600 text-center">
          🛡️ Your streak is private by default. Enable leaderboard visibility in Settings → Privacy.
        </p>
      </ScrollReveal>
    </div>
  )
}

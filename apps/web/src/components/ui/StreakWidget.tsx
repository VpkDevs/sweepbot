import { useQuery } from '@tanstack/react-query'
import { Flame, TrendingDown, Minus, Trophy } from 'lucide-react'
import { api } from '../../lib/api'
import { cn } from '../../lib/utils'

/**
 * Renders a streak status card showing the current win or loss streak, a loading placeholder, or a no-active-streak message.
 *
 * @returns A React element that displays the current streak (win or loss) with contextual iconography and colors, an animated loading placeholder while data is being fetched, or a "No active streak" message when there is no active streak.
 */
export function StreakWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ['features', 'streaks'],
    queryFn: () => api.features.streaks(),
  })

  if (isLoading) {
    return <div className="glass-card shimmer h-[80px] rounded-2xl p-4" />
  }

  const streaks = (data ?? {}) as Record<string, number>
  const currentWin = streaks['current_win_streak'] ?? 0
  const currentLoss = streaks['current_loss_streak'] ?? 0
  const longestWin = streaks['longest_win_streak'] ?? 0

  if (currentWin === 0 && currentLoss === 0) {
    return (
      <div className="glass-card animate-fade-in flex items-center gap-3 rounded-2xl p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800/50">
          <Minus className="h-4 w-4 text-zinc-600" />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">Streak</p>
          <p className="mt-0.5 text-sm text-zinc-500">No active streak</p>
        </div>
      </div>
    )
  }

  const isWinStreak = currentWin > 0
  const streakCount = isWinStreak ? currentWin : currentLoss
  const isOnFire = streakCount >= 7
  const isHot = streakCount >= 3

  return (
    <div
      className={cn(
        'glass-card animate-fade-in shine-on-hover flex items-center gap-3 rounded-2xl p-4 transition-all',
        isWinStreak && isOnFire && 'gradient-border-win shadow-emerald-500/10',
        isWinStreak && !isOnFire && 'ring-1 ring-emerald-500/15',
        !isWinStreak && 'ring-1 ring-red-500/15'
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          'relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl',
          isWinStreak
            ? isOnFire
              ? 'bg-gradient-to-br from-orange-500/20 to-yellow-500/20'
              : 'bg-emerald-500/10'
            : 'bg-red-500/10'
        )}
      >
        {isOnFire ? (
          <>
            <span className="animate-float text-2xl">🔥</span>
            <div className="animate-glow-pulse absolute inset-0 rounded-xl bg-orange-400/10" />
            <div className="animate-breathe absolute -inset-1 rounded-2xl bg-orange-500/5" />
          </>
        ) : isWinStreak ? (
          <Flame className="h-5 w-5 text-emerald-400" />
        ) : (
          <TrendingDown className="h-5 w-5 text-red-400" />
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">
          {isWinStreak ? 'Win Streak' : 'Loss Streak'}
          {isOnFire && (
            <span className="animate-glow-pulse ml-1.5 normal-case tracking-normal text-orange-400">
              On fire!
            </span>
          )}
        </p>
        <div className="mt-0.5 flex items-baseline gap-1.5">
          <p
            className={cn(
              'text-2xl font-black tabular-nums tracking-tight',
              isWinStreak ? 'text-emerald-400' : 'text-red-400',
              isOnFire && 'gradient-text-fire'
            )}
          >
            {streakCount}
          </p>
          <span className="text-xs font-medium text-zinc-500">
            {streakCount === 1 ? 'session' : 'sessions'}
          </span>
        </div>

        {/* Progress to fire threshold */}
        {isWinStreak && isHot && !isOnFire && (
          <div className="mt-2 flex items-center gap-2">
            <div className="progress-bar-container flex-1">
              <div
                className="progress-bar-fill bg-gradient-to-r from-emerald-600 to-emerald-400"
                style={{ width: `${(streakCount / 7) * 100}%` }}
              />
            </div>
            <span className="whitespace-nowrap text-[10px] font-medium tabular-nums text-zinc-600">
              {7 - streakCount} to 🔥
            </span>
          </div>
        )}
      </div>

      {/* Best streak badge */}
      {isWinStreak && longestWin > 0 && (
        <div className="flex flex-col items-center gap-0.5 border-l border-white/[0.04] pl-3">
          <Trophy className="h-3.5 w-3.5 text-zinc-600" />
          <p className="text-sm font-bold tabular-nums text-zinc-400">{longestWin}</p>
          <p className="text-[9px] font-medium leading-none text-zinc-600">best</p>
        </div>
      )}
    </div>
  )
}

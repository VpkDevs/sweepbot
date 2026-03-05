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
    return <div className="glass-card rounded-2xl p-4 h-[80px] shimmer" />
  }

  const streaks = (data ?? {}) as Record<string, number>
  const currentWin = streaks['current_win_streak'] ?? 0
  const currentLoss = streaks['current_loss_streak'] ?? 0
  const longestWin = streaks['longest_win_streak'] ?? 0

  if (currentWin === 0 && currentLoss === 0) {
    return (
      <div className="glass-card rounded-2xl p-4 flex items-center gap-3 animate-fade-in">
        <div className="w-10 h-10 rounded-xl bg-zinc-800/50 flex items-center justify-center">
          <Minus className="w-4 h-4 text-zinc-600" />
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 uppercase tracking-[0.15em] font-bold">Streak</p>
          <p className="text-sm text-zinc-500 mt-0.5">No active streak</p>
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
        'glass-card rounded-2xl p-4 flex items-center gap-3 animate-fade-in transition-all shine-on-hover',
        isWinStreak && isOnFire && 'gradient-border-win shadow-emerald-500/10',
        isWinStreak && !isOnFire && 'ring-1 ring-emerald-500/15',
        !isWinStreak && 'ring-1 ring-red-500/15',
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          'relative flex items-center justify-center w-11 h-11 rounded-xl flex-shrink-0',
          isWinStreak
            ? isOnFire
              ? 'bg-gradient-to-br from-orange-500/20 to-yellow-500/20'
              : 'bg-emerald-500/10'
            : 'bg-red-500/10',
        )}
      >
        {isOnFire ? (
          <>
            <span className="text-2xl animate-float">🔥</span>
            <div className="absolute inset-0 rounded-xl bg-orange-400/10 animate-glow-pulse" />
            <div className="absolute -inset-1 rounded-2xl bg-orange-500/5 animate-breathe" />
          </>
        ) : isWinStreak ? (
          <Flame className="w-5 h-5 text-emerald-400" />
        ) : (
          <TrendingDown className="w-5 h-5 text-red-400" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-zinc-500 uppercase tracking-[0.15em] font-bold">
          {isWinStreak ? 'Win Streak' : 'Loss Streak'}
          {isOnFire && <span className="ml-1.5 text-orange-400 normal-case tracking-normal animate-glow-pulse">On fire!</span>}
        </p>
        <div className="flex items-baseline gap-1.5 mt-0.5">
          <p
            className={cn(
              'text-2xl font-black tabular-nums tracking-tight',
              isWinStreak ? 'text-emerald-400' : 'text-red-400',
              isOnFire && 'gradient-text-fire',
            )}
          >
            {streakCount}
          </p>
          <span className="text-xs text-zinc-500 font-medium">
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
            <span className="text-[10px] text-zinc-600 tabular-nums whitespace-nowrap font-medium">
              {7 - streakCount} to 🔥
            </span>
          </div>
        )}
      </div>

      {/* Best streak badge */}
      {isWinStreak && longestWin > 0 && (
        <div className="flex flex-col items-center gap-0.5 pl-3 border-l border-white/[0.04]">
          <Trophy className="w-3.5 h-3.5 text-zinc-600" />
          <p className="text-sm font-bold text-zinc-400 tabular-nums">{longestWin}</p>
          <p className="text-[9px] text-zinc-600 leading-none font-medium">best</p>
        </div>
      )}
    </div>
  )
}

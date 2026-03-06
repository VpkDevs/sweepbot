import { useQuery } from '@tanstack/react-query'
import { Flame, TrendingDown, Minus } from 'lucide-react'
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
    return <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 h-[72px] animate-pulse" />
  }

  const streaks = (data ?? {}) as Record<string, number>
  const currentWin = streaks['current_win_streak'] ?? 0
  const currentLoss = streaks['current_loss_streak'] ?? 0
  const longestWin = streaks['longest_win_streak'] ?? 0

  if (currentWin === 0 && currentLoss === 0) {
    return (
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 flex items-center gap-3">
        <Minus className="w-5 h-5 text-zinc-600" />
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-wide font-medium">Streak</p>
          <p className="text-sm text-zinc-500">No active streak</p>
        </div>
      </div>
    )
  }

  const isWinStreak = currentWin > 0
  const streakCount = isWinStreak ? currentWin : currentLoss
  const isOnFire = streakCount >= 7

  return (
    <div
      className={cn(
        'bg-zinc-900 rounded-xl border p-4 flex items-center gap-3',
        isWinStreak ? 'border-emerald-800/50' : 'border-red-900/50',
      )}
    >
      {isOnFire ? (
        <span className="text-2xl animate-bounce">🔥</span>
      ) : isWinStreak ? (
        <Flame className="w-5 h-5 text-emerald-400" />
      ) : (
        <TrendingDown className="w-5 h-5 text-red-400" />
      )}

      <div className="flex-1">
        <p className="text-xs text-zinc-500 uppercase tracking-wide font-medium">
          {isWinStreak ? 'Win Streak' : 'Loss Streak'}
        </p>
        <p className={cn('text-xl font-bold tabular-nums', isWinStreak ? 'text-emerald-400' : 'text-red-400')}>
          {streakCount}
          <span className="text-sm font-normal text-zinc-500 ml-1">
            {streakCount === 1 ? 'session' : 'sessions'}
          </span>
        </p>
      </div>

      {isWinStreak && longestWin > 0 && (
        <div className="text-right">
          <p className="text-xs text-zinc-600">Best</p>
          <p className="text-sm font-semibold text-zinc-400">{longestWin}</p>
        </div>
      )}
    </div>
  )
}

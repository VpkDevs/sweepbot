import { Flame, Shield, CheckCircle2 } from 'lucide-react'
import { useStreak } from '../../hooks/useStreak'
import { cn } from '../../lib/utils'

// Day milestones
const MILESTONES = [7, 30, 100, 365] as const

function getNextMilestone(current: number): number {
  return MILESTONES.find((m) => m > current) ?? MILESTONES[MILESTONES.length - 1]
}

function isTodayCheckedIn(lastActivityDate: string | null): boolean {
  if (!lastActivityDate) return false
  const today = new Date().toISOString().slice(0, 10)
  return lastActivityDate.slice(0, 10) === today
}

/**
 * Shows the user's daily activity streak with fire emoji, shield credits,
 * a milestone progress bar, and a daily check-in button.
 */
export function DailyStreakWidget() {
  const { streak, isLoading, isRecording, recordActivity } = useStreak()

  if (isLoading) {
    return <div className="glass-card rounded-2xl p-4 h-[108px] shimmer" />
  }

  const currentStreak = streak?.currentStreak ?? 0
  const longestStreak = streak?.longestStreak ?? 0
  const freezeCredits = streak?.freezeCredits ?? 0
  const lastActivity = streak?.lastActivityDate ?? null

  const checkedIn = isTodayCheckedIn(lastActivity)
  const nextMilestone = getNextMilestone(currentStreak)
  const nextIdx = MILESTONES.findIndex((m) => m >= nextMilestone)
  const prevMilestone = nextIdx > 0 ? MILESTONES[nextIdx - 1]! : 0
  const progressPct = nextMilestone === prevMilestone
    ? 100
    : Math.min(100, Math.round(((currentStreak - prevMilestone) / (nextMilestone - prevMilestone)) * 100))

  const isOnFire = currentStreak >= 7

  return (
    <div
      className={cn(
        'glass-card rounded-2xl p-4 flex flex-col gap-3 animate-fade-in transition-all',
        isOnFire && 'ring-1 ring-orange-500/25 shadow-orange-500/5',
        !isOnFire && 'ring-1 ring-white/[0.04]',
      )}
    >
      {/* ── Top row ── */}
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div
          className={cn(
            'relative flex items-center justify-center w-11 h-11 rounded-xl flex-shrink-0',
            isOnFire
              ? 'bg-gradient-to-br from-orange-500/20 to-yellow-500/20'
              : 'bg-orange-500/10',
          )}
        >
          {isOnFire ? (
            <>
              <span className="text-2xl animate-float">🔥</span>
              <div className="absolute inset-0 rounded-xl bg-orange-400/10 animate-glow-pulse" />
            </>
          ) : (
            <Flame className="w-5 h-5 text-orange-400" />
          )}
        </div>

        {/* Streak count */}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-zinc-500 uppercase tracking-[0.15em] font-bold">
            Daily Streak
          </p>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <p
              className={cn(
                'text-2xl font-black tabular-nums tracking-tight',
                isOnFire ? 'gradient-text-fire' : 'text-orange-400',
              )}
            >
              {currentStreak}
            </p>
            <span className="text-xs text-zinc-500 font-medium">
              {currentStreak === 1 ? 'day' : 'days'}
            </span>
          </div>
        </div>

        {/* Shield credits */}
        {freezeCredits > 0 && (
          <div className="flex flex-col items-center gap-0.5 pl-3 border-l border-white/[0.04]">
            <Shield className="w-3.5 h-3.5 text-blue-400" />
            <p className="text-sm font-bold text-blue-300 tabular-nums">{freezeCredits}</p>
            <p className="text-[9px] text-zinc-600 font-medium leading-none">shields</p>
          </div>
        )}

        {/* Longest streak badge */}
        {longestStreak > 0 && (
          <div className="flex flex-col items-center gap-0.5 pl-3 border-l border-white/[0.04]">
            <CheckCircle2 className="w-3.5 h-3.5 text-zinc-600" />
            <p className="text-sm font-bold text-zinc-400 tabular-nums">{longestStreak}</p>
            <p className="text-[9px] text-zinc-600 leading-none font-medium">best</p>
          </div>
        )}
      </div>

      {/* ── Progress bar to next milestone ── */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] text-zinc-600 font-medium">
          <span>Next milestone</span>
          <span className="tabular-nums">{currentStreak} / {nextMilestone} days</span>
        </div>
        <div className="progress-bar-container">
          <div
            className={cn(
              'progress-bar-fill',
              isOnFire
                ? 'bg-gradient-to-r from-orange-600 to-yellow-400'
                : 'bg-gradient-to-r from-orange-700 to-orange-500',
            )}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* ── Check-in button ── */}
      <button
        type="button"
        onClick={() => recordActivity()}
        disabled={checkedIn || isRecording}
        className={cn(
          'w-full py-1.5 rounded-xl text-xs font-semibold transition-all press-scale',
          checkedIn
            ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20 cursor-default'
            : 'bg-orange-500/15 text-orange-300 ring-1 ring-orange-500/25 hover:bg-orange-500/25',
          isRecording && 'opacity-60 cursor-wait',
        )}
      >
        {checkedIn ? '✓ Checked in today' : isRecording ? 'Checking in…' : '🔥 Check In'}
      </button>
    </div>
  )
}

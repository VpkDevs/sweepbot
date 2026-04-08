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
    return <div className="glass-card shimmer h-[108px] rounded-2xl p-4" />
  }

  const currentStreak = streak?.currentStreak ?? 0
  const longestStreak = streak?.longestStreak ?? 0
  const freezeCredits = streak?.freezeCredits ?? 0
  const lastActivity = streak?.lastActivityDate ?? null

  const checkedIn = isTodayCheckedIn(lastActivity)
  const nextMilestone = getNextMilestone(currentStreak)
  const nextIdx = MILESTONES.findIndex((m) => m >= nextMilestone)
  const prevMilestone = nextIdx > 0 ? (MILESTONES[nextIdx - 1] ?? 0) : 0
  const progressPct =
    nextMilestone === prevMilestone
      ? 100
      : Math.min(
          100,
          Math.round(((currentStreak - prevMilestone) / (nextMilestone - prevMilestone)) * 100)
        )

  const isOnFire = currentStreak >= 7

  return (
    <div
      className={cn(
        'glass-card animate-fade-in flex flex-col gap-3 rounded-2xl p-4 transition-all',
        isOnFire && 'shadow-orange-500/5 ring-1 ring-orange-500/25',
        !isOnFire && 'ring-1 ring-white/[0.04]'
      )}
    >
      {/* ── Top row ── */}
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div
          className={cn(
            'relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl',
            isOnFire ? 'bg-gradient-to-br from-orange-500/20 to-yellow-500/20' : 'bg-orange-500/10'
          )}
        >
          {isOnFire ? (
            <>
              <span className="animate-float text-2xl">🔥</span>
              <div className="animate-glow-pulse absolute inset-0 rounded-xl bg-orange-400/10" />
            </>
          ) : (
            <Flame className="h-5 w-5 text-orange-400" />
          )}
        </div>

        {/* Streak count */}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">
            Daily Streak
          </p>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <p
              className={cn(
                'text-2xl font-black tabular-nums tracking-tight',
                isOnFire ? 'gradient-text-fire' : 'text-orange-400'
              )}
            >
              {currentStreak}
            </p>
            <span className="text-xs font-medium text-zinc-500">
              {currentStreak === 1 ? 'day' : 'days'}
            </span>
          </div>
        </div>

        {/* Shield credits */}
        {freezeCredits > 0 && (
          <div className="flex flex-col items-center gap-0.5 border-l border-white/[0.04] pl-3">
            <Shield className="h-3.5 w-3.5 text-blue-400" />
            <p className="text-sm font-bold tabular-nums text-blue-300">{freezeCredits}</p>
            <p className="text-[9px] font-medium leading-none text-zinc-600">shields</p>
          </div>
        )}

        {/* Longest streak badge */}
        {longestStreak > 0 && (
          <div className="flex flex-col items-center gap-0.5 border-l border-white/[0.04] pl-3">
            <CheckCircle2 className="h-3.5 w-3.5 text-zinc-600" />
            <p className="text-sm font-bold tabular-nums text-zinc-400">{longestStreak}</p>
            <p className="text-[9px] font-medium leading-none text-zinc-600">best</p>
          </div>
        )}
      </div>

      {/* ── Progress bar to next milestone ── */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] font-medium text-zinc-600">
          <span>Next milestone</span>
          <span className="tabular-nums">
            {currentStreak} / {nextMilestone} days
          </span>
        </div>
        <div className="progress-bar-container">
          <div
            className={cn(
              'progress-bar-fill',
              isOnFire
                ? 'bg-gradient-to-r from-orange-600 to-yellow-400'
                : 'bg-gradient-to-r from-orange-700 to-orange-500'
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
          'press-scale w-full rounded-xl py-1.5 text-xs font-semibold transition-all',
          checkedIn
            ? 'cursor-default bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20'
            : 'bg-orange-500/15 text-orange-300 ring-1 ring-orange-500/25 hover:bg-orange-500/25',
          isRecording && 'cursor-wait opacity-60'
        )}
      >
        {checkedIn ? '✓ Checked in today' : isRecording ? 'Checking in…' : '🔥 Check In'}
      </button>
    </div>
  )
}

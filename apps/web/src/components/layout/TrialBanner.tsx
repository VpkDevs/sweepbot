import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { X, Zap } from 'lucide-react'
import { api } from '../../lib/api'
import { cn } from '../../lib/utils'

const DISMISSED_KEY = 'trial-banner-dismissed'

function todayString(): string {
  // Use local date so the banner re-shows at midnight in the user's timezone
  return new Date().toLocaleDateString('en-CA') // yields YYYY-MM-DD
}

function isDismissedToday(): boolean {
  try {
    const stored = localStorage.getItem(DISMISSED_KEY)
    if (!stored) return false
    return stored === todayString()
  } catch {
    return false
  }
}

function setDismissedToday(): void {
  try {
    localStorage.setItem(DISMISSED_KEY, todayString())
  } catch {
    // ignore
  }
}

interface TrialStatus {
  isActive: boolean
  daysRemaining: number
  trialEndsAt: string | null
  tier: string
  converted: boolean
}

/**
 * Dismissible amber/orange gradient banner that shows trial countdown.
 * Re-shows daily even if previously dismissed.
 */
export function TrialBanner() {
  const [dismissed, setDismissed] = useState(() => isDismissedToday())

  const { data: trialStatus } = useQuery({
    queryKey: ['subscriptions', 'trial-status'],
    queryFn: () => api.subscriptions.trialStatus() as Promise<TrialStatus | null>,
  })

  if (dismissed || !trialStatus?.isActive) return null

  const days = trialStatus.daysRemaining

  return (
    <div
      className={cn(
        'relative flex items-center gap-3 px-4 py-2.5 text-sm font-medium',
        'bg-gradient-to-r from-amber-600/90 via-orange-500/90 to-amber-500/90',
        'border-b border-orange-400/20',
        'animate-fade-in',
      )}
      role="banner"
    >
      <Zap className="w-4 h-4 text-white flex-shrink-0" />
      <span className="text-white/95 flex-1">
        ⚡ {days === 1 ? '1 day' : `${days} days`} left in your Pro trial
      </span>
      <Link
        to="/pricing"
        className="px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-semibold transition-colors press-scale flex-shrink-0"
      >
        Upgrade Now
      </Link>
      <button
        type="button"
        aria-label="Dismiss trial banner"
        onClick={() => {
          setDismissedToday()
          setDismissed(true)
        }}
        className="flex-shrink-0 text-white/70 hover:text-white transition-colors press-scale"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

import { useState } from 'react'
import { Rocket, CheckCircle2, Loader2 } from 'lucide-react'
import { api } from '../../lib/api'
import { cn } from '../../lib/utils'

const PRO_FEATURES = [
  'Unlimited session tracking',
  'Advanced analytics & RTP insights',
  'SweepBot automation flows',
  'Jackpot intelligence alerts',
  'TOS change monitoring',
  'Priority platform trust scores',
]

interface Props {
  onActivated: () => void
  onSkip: () => void
}

/**
 * Modal/card presented to new users offering a 14-day Pro trial.
 * Calls the start-trial endpoint, shows loading/error states, and
 * invokes callbacks on completion or skip.
 */
export function TrialActivation({ onActivated, onSkip }: Props) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleStart = async () => {
    setIsLoading(true)
    setError(null)
    try {
      await api.subscriptions.startTrial()
      onActivated()
    } catch (err) {
      if (err instanceof Error) {
        // Common case: trial already used
        if (
          err.message.toLowerCase().includes('already') ||
          err.message.toLowerCase().includes('used')
        ) {
          setError("You've already used your free trial. Upgrade to Pro to continue.")
        } else {
          setError(err.message)
        }
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="glass-card-elevated animate-fade-in mx-auto w-full max-w-md space-y-6 rounded-3xl p-8">
      {/* Header */}
      <div className="space-y-2 text-center">
        <div className="from-brand-500/20 to-brand-700/20 ring-brand-500/20 mb-2 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ring-1">
          <Rocket className="text-brand-400 h-7 w-7" />
        </div>
        <h2 className="text-2xl font-black text-white">🚀 Start Your 14-Day Pro Trial</h2>
        <p className="text-sm text-zinc-400">No credit card required</p>
      </div>

      {/* Feature list */}
      <ul className="space-y-2.5">
        {PRO_FEATURES.map((feature) => (
          <li key={feature} className="flex items-center gap-3 text-sm text-zinc-300">
            <CheckCircle2 className="text-brand-400 h-4 w-4 flex-shrink-0" />
            {feature}
          </li>
        ))}
      </ul>

      {/* Error */}
      {error && (
        <p className="rounded-xl bg-red-500/10 px-4 py-2.5 text-sm text-red-400 ring-1 ring-red-500/20">
          {error}
        </p>
      )}

      {/* Actions */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => void handleStart()}
          disabled={isLoading}
          className={cn(
            'press-scale w-full rounded-xl py-3 text-sm font-semibold transition-all',
            'from-brand-600 to-brand-500 bg-gradient-to-r text-white',
            'shadow-brand-500/25 hover:shadow-brand-500/40 shadow-lg',
            isLoading && 'cursor-wait opacity-70'
          )}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Starting trial…
            </span>
          ) : (
            'Start Free Trial'
          )}
        </button>

        <button
          type="button"
          onClick={onSkip}
          disabled={isLoading}
          className="w-full py-2 text-sm text-zinc-500 transition-colors hover:text-zinc-300"
        >
          Maybe later
        </button>
      </div>
    </div>
  )
}

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
        if (err.message.toLowerCase().includes('already') || err.message.toLowerCase().includes('used')) {
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
    <div className="glass-card-elevated rounded-3xl p-8 max-w-md w-full mx-auto animate-fade-in space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500/20 to-brand-700/20 ring-1 ring-brand-500/20 mb-2">
          <Rocket className="w-7 h-7 text-brand-400" />
        </div>
        <h2 className="text-2xl font-black text-white">
          🚀 Start Your 14-Day Pro Trial
        </h2>
        <p className="text-zinc-400 text-sm">No credit card required</p>
      </div>

      {/* Feature list */}
      <ul className="space-y-2.5">
        {PRO_FEATURES.map((feature) => (
          <li key={feature} className="flex items-center gap-3 text-sm text-zinc-300">
            <CheckCircle2 className="w-4 h-4 text-brand-400 flex-shrink-0" />
            {feature}
          </li>
        ))}
      </ul>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 rounded-xl px-4 py-2.5 ring-1 ring-red-500/20">
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
            'w-full py-3 rounded-xl font-semibold text-sm transition-all press-scale',
            'bg-gradient-to-r from-brand-600 to-brand-500 text-white',
            'shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40',
            isLoading && 'opacity-70 cursor-wait',
          )}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
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
          className="w-full py-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Maybe later
        </button>
      </div>
    </div>
  )
}

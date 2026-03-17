import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useRouter } from '@tanstack/react-router'
import { useAuthStore } from '../../stores/auth'

// Per-user key so onboarding is independent across different accounts on the same browser.
function storageKey(userId: string | undefined): string {
  return `sweepbot_onboarding_v1_complete_${userId ?? 'guest'}`
}

interface Step {
  title: string
  description: string
  cardPosition: React.CSSProperties
  // Dots indicating where on the screen this step points (optional visual hint)
  hint?: string
}

const steps: Step[] = [
  {
    title: 'Welcome to SweepBot 👋',
    description:
      "This is your Command Center — your complete sweepstakes portfolio at a glance. Let us take you on a quick tour so you know where everything lives.",
    cardPosition: { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
  },
  {
    title: 'Your Key Stats',
    description:
      'These four cards give you an instant snapshot: Net P&L shows your total profit or loss in SC, Personal RTP tracks your return-to-player percentage, Active Platforms counts what you\'re playing on, and Hours Played shows your total time invested.',
    cardPosition: { top: '28%', left: '50%', transform: 'translateX(-50%)' },
    hint: '↑ Stat cards above',
  },
  {
    title: '7-Day Activity Chart',
    description:
      'This area chart plots your net sweepstakes coin performance over the past 7 days. Use it to spot winning streaks, identify rough patches, and gauge whether your recent sessions are trending up or down.',
    cardPosition: { top: '58%', left: '38%', transform: 'translate(-50%, -50%)' },
    hint: '↑ Activity chart above',
  },
  {
    title: 'Jackpot Tracker',
    description:
      'The Jackpot Tracker monitors progressive jackpots across all your platforms in real time — total jackpots tracked, their combined value, 24-hour hits, and what\'s been paid out over the last 30 days.',
    cardPosition: { top: '58%', right: '2%', transform: 'translateY(-50%)' },
    hint: '← Jackpot panel to the left',
  },
  {
    title: 'Platform Performance',
    description:
      'This table breaks down every platform you play on: sessions logged, total SC wagered, net profit (green = win, red = loss), RTP percentage, and when you last played there. Click any row to drill into that platform.',
    cardPosition: { bottom: '6%', left: '50%', transform: 'translateX(-50%)' },
    hint: '↑ Platform table above',
  },
  {
    title: 'Sidebar Navigation',
    description:
      'Use the sidebar to jump between every section: Sessions to log plays, Analytics for deep stats, Jackpots for live tracking, Redemptions for cash-out history, and SweepBot Flows to automate your entire grind. You\'re all set!',
    cardPosition: { top: '50%', left: '280px', transform: 'translateY(-50%)' },
    hint: '← Sidebar on the left',
  },
]

export function OnboardingTour() {
  const router = useRouter()
  const userId = useAuthStore((s) => s.user?.id)
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(false)
  const [animating, setAnimating] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const goToTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Only show tour on dashboard route
  const isDashboard = router.state.location.pathname === '/'

  useEffect(() => {
    if (!isDashboard) {
      setVisible(false)
      return
    }

    // Try to read from localStorage with error handling.
    // Key is per-user so onboarding is independent across different accounts.
    try {
      const done = localStorage.getItem(storageKey(userId))
      if (!done) {
        // Small delay so the dashboard renders first
        timeoutRef.current = setTimeout(() => setVisible(true), 600)
      }
    } catch (err) {
      // localStorage may be unavailable (private browsing, etc.)
      console.warn('localStorage unavailable for onboarding', err)
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [isDashboard, userId])

  const dismiss = () => {
    try {
      localStorage.setItem(storageKey(userId), '1')
    } catch (err) {
      console.warn('Could not save onboarding state', err)
    }
    setVisible(false)
  }

  const goTo = (nextStep: number) => {
    if (animating) return
    setAnimating(true)
    if (goToTimeoutRef.current) clearTimeout(goToTimeoutRef.current)
    goToTimeoutRef.current = setTimeout(() => {
      setStep(nextStep)
      setAnimating(false)
    }, 150)
  }

  useEffect(() => {
    return () => {
      if (goToTimeoutRef.current) {
        clearTimeout(goToTimeoutRef.current)
        goToTimeoutRef.current = null
      }
    }
  }, [])

  const prev = () => {
    if (step > 0) goTo(step - 1)
  }

  const next = () => {
    if (step < steps.length - 1) {
      goTo(step + 1)
    } else {
      dismiss()
    }
  }

  if (!visible) return null

  const current = steps[step]

  return (
    <div className="fixed inset-0 z-50">
      {/* Blurred backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={dismiss}
      />

      {/* Tour card */}
      <div
        className="absolute w-[340px] transition-opacity duration-150"
        style={{
          ...current.cardPosition,
          opacity: animating ? 0 : 1,
        }}
      >
        {/* Glow ring */}
        <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-brand-500/40 via-transparent to-brand-700/20 pointer-events-none" />

        <div className="relative bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl shadow-black/60 p-6 space-y-4">
          {/* Close button */}
          <button
            onClick={dismiss}
            className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
            aria-label="Close tour"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Title */}
          <h3 className="text-white font-semibold text-base leading-snug pr-6">
            {current.title}
          </h3>

          {/* Description */}
          <p className="text-zinc-400 text-sm leading-relaxed">
            {current.description}
          </p>

          {/* Hint label */}
          {current.hint && (
            <p className="text-brand-400/80 text-xs font-medium">{current.hint}</p>
          )}

          {/* Step dots */}
          <div className="flex justify-center gap-1.5 pt-1">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className="transition-all duration-200"
                aria-label={`Go to step ${i + 1}`}
              >
                <span
                  className={`block rounded-full transition-all duration-200 ${
                    i === step
                      ? 'w-4 h-1.5 bg-brand-500'
                      : 'w-1.5 h-1.5 bg-zinc-600 hover:bg-zinc-500'
                  }`}
                />
              </button>
            ))}
          </div>

          {/* Footer controls */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-zinc-500 font-medium tabular-nums">
              {step + 1} of {steps.length}
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={dismiss}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 rounded"
              >
                Skip
              </button>

              <button
                onClick={prev}
                disabled={step === 0}
                className="flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-300 hover:text-white transition-colors"
                aria-label="Previous step"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                onClick={next}
                className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-600 hover:bg-brand-500 text-white transition-colors"
                aria-label={step === steps.length - 1 ? 'Finish tour' : 'Next step'}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

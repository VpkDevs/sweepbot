import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, BellOff, Check, Loader2 } from 'lucide-react'
import { api } from '../../lib/api'
import { cn } from '../../lib/utils'

type PrefKey =
  | 'jackpotAlerts'
  | 'tosChanges'
  | 'platformOutages'
  | 'flowErrors'
  | 'trialReminders'
  | 'dailySummary'
  | 'weeklyReport'

const PREF_LABELS: Record<PrefKey, { label: string; description: string }> = {
  jackpotAlerts: {
    label: 'Jackpot Alerts',
    description: 'Get notified when jackpots hit new highs',
  },
  tosChanges: {
    label: 'TOS Changes',
    description: 'Plain-English alerts when platform terms change',
  },
  platformOutages: { label: 'Platform Outages', description: 'Know when a platform goes down' },
  flowErrors: { label: 'Flow Errors', description: 'Alerts when an automation flow fails' },
  trialReminders: { label: 'Trial Reminders', description: 'Reminders before your trial expires' },
  dailySummary: { label: 'Daily Summary', description: 'Daily digest of your activity' },
  weeklyReport: { label: 'Weekly Report', description: 'Weekly performance report' },
}

const ALL_PREF_KEYS: PrefKey[] = [
  'jackpotAlerts',
  'tosChanges',
  'platformOutages',
  'flowErrors',
  'trialReminders',
  'dailySummary',
  'weeklyReport',
]

function ToggleSwitch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 rounded-full transition-colors duration-200 focus-visible:outline-none',
        checked ? 'bg-brand-500' : 'bg-zinc-700',
        disabled && 'cursor-not-allowed opacity-50'
      )}
    >
      <span
        className={cn(
          'mt-0.5 inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200',
          checked ? 'translate-x-4' : 'translate-x-0.5'
        )}
      />
    </button>
  )
}

/**
 * Settings panel for notification preferences, including push notification subscribe.
 */
export function NotificationPreferences() {
  const queryClient = useQueryClient()

  const { data: rawPrefs, isLoading } = useQuery({
    queryKey: ['notifications', 'preferences'],
    queryFn: () => api.notifications.preferences(),
  })

  const [localPrefs, setLocalPrefs] = useState<Record<PrefKey, boolean>>(
    () => Object.fromEntries(ALL_PREF_KEYS.map((k) => [k, true])) as Record<PrefKey, boolean>
  )
  const [saved, setSaved] = useState(false)
  const [pushStatus, setPushStatus] = useState<'idle' | 'subscribing' | 'subscribed' | 'error'>(
    'idle'
  )

  // Sync server prefs into local state
  useEffect(() => {
    if (!rawPrefs) return
    setLocalPrefs((prev) => {
      const next = { ...prev }
      for (const key of ALL_PREF_KEYS) {
        if (typeof rawPrefs[key] === 'boolean') {
          next[key] = rawPrefs[key] as boolean
        }
      }
      return next
    })
  }, [rawPrefs])

  const { mutate: savePrefs, isPending: isSaving } = useMutation({
    mutationFn: () => api.notifications.updatePreferences(localPrefs as Record<string, boolean>),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications', 'preferences'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    },
  })

  const handleToggle = (key: PrefKey, value: boolean) => {
    setLocalPrefs((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const handleSubscribePush = async () => {
    setPushStatus('subscribing')
    try {
      const reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      const subscription =
        existing ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined,
        }))
      await api.notifications.subscribePush(
        JSON.parse(JSON.stringify(subscription)) as Record<string, unknown>
      )
      setPushStatus('subscribed')
    } catch {
      setPushStatus('error')
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="shimmer h-14 rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Preference toggles */}
      <div className="glass-card divide-y divide-white/[0.04] rounded-2xl">
        {ALL_PREF_KEYS.map((key) => {
          const { label, description } = PREF_LABELS[key]
          return (
            <div key={key} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-200">{label}</p>
                <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
              </div>
              <ToggleSwitch
                checked={localPrefs[key]}
                onChange={(v) => handleToggle(key, v)}
                disabled={isSaving}
              />
            </div>
          )
        })}
      </div>

      {/* Push notifications */}
      <div className="glass-card space-y-3 rounded-2xl p-4">
        <div className="flex items-center gap-2">
          <Bell className="text-brand-400 h-4 w-4" />
          <p className="text-sm font-semibold text-zinc-200">Push Notifications</p>
        </div>
        <p className="text-xs text-zinc-500">
          Receive real-time alerts in your browser even when SweepBot isn't open.
        </p>

        {pushStatus === 'subscribed' ? (
          <div className="flex items-center gap-2 text-sm text-emerald-400">
            <Check className="h-4 w-4" />
            Push notifications enabled
          </div>
        ) : pushStatus === 'error' ? (
          <p className="text-xs text-red-400">Failed to enable push. Check browser permissions.</p>
        ) : (
          <button
            type="button"
            onClick={() => void handleSubscribePush()}
            disabled={pushStatus === 'subscribing'}
            className={cn(
              'press-scale flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all',
              'bg-brand-500/15 text-brand-300 ring-brand-500/30 hover:bg-brand-500/25 ring-1',
              pushStatus === 'subscribing' && 'cursor-wait opacity-60'
            )}
          >
            {pushStatus === 'subscribing' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <BellOff className="h-3.5 w-3.5" />
            )}
            Enable Push Notifications
          </button>
        )}
      </div>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => savePrefs()}
          disabled={isSaving}
          className={cn(
            'press-scale flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold transition-all',
            'bg-brand-600 hover:bg-brand-500 text-white',
            isSaving && 'cursor-wait opacity-60'
          )}
        >
          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Save Preferences
        </button>
        {saved && (
          <span className="animate-fade-in flex items-center gap-1 text-sm text-emerald-400">
            <Check className="h-3.5 w-3.5" />
            Saved
          </span>
        )}
      </div>
    </div>
  )
}

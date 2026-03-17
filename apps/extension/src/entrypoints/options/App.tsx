import { useState, useEffect } from 'react'
import { Save, AlertCircle } from 'lucide-react'
import { storage } from '@/lib/storage'
import type { NotificationPreferences } from '@/lib/storage'

export default function OptionsApp() {
  const [hudPosition, setHudPosition] = useState<
    'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  >('bottom-right')
  const [notifications, setNotifications] = useState<NotificationPreferences>({
    enableSurgeAlerts: true,
    enableJackpotAlerts: true,
    enableDailyDigest: true,
    enableBonusReminders: true,
    muted: false,
  })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function loadSettings() {
      const pos = await storage.get('hudPosition')
      const notif = await storage.get('notificationPrefs')

      setHudPosition(pos ?? 'bottom-right')
      setNotifications(notif ?? notifications)
    }

    loadSettings()
  }, [])

  const handleSave = async () => {
    await storage.set('hudPosition', hudPosition)
    await storage.set('notificationPrefs', notifications)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="options-container min-h-screen bg-gray-50">
      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">SweepBot Settings</h1>
          <p className="mt-2 text-gray-600">Customize your extension experience</p>
        </div>

        {/* Settings Sections */}
        <div className="space-y-6">
          {/* HUD Settings */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">HUD Display</h2>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="hud-position"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  HUD Position
                </label>
                <select
                  id="hud-position"
                  value={hudPosition}
                  onChange={(e) =>
                    setHudPosition(
                      e.target.value as import('@/lib/storage').StorageSchema['hudPosition']
                    )
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="bottom-right">Bottom Right</option>
                  <option value="bottom-left">Bottom Left</option>
                  <option value="top-right">Top Right</option>
                  <option value="top-left">Top Left</option>
                </select>
              </div>

              <p className="text-xs text-gray-500">
                Choose where the HUD overlay appears on casino pages
              </p>
            </div>
          </div>

          {/* Notification Settings */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Notifications</h2>

            <div className="space-y-3">
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={notifications.enableSurgeAlerts}
                  onChange={(e) =>
                    setNotifications({
                      ...notifications,
                      enableSurgeAlerts: e.target.checked,
                    })
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
                <span className="text-sm text-gray-900">Jackpot Surge Alerts</span>
              </label>

              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={notifications.enableJackpotAlerts}
                  onChange={(e) =>
                    setNotifications({
                      ...notifications,
                      enableJackpotAlerts: e.target.checked,
                    })
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
                <span className="text-sm text-gray-900">Near-Hit Jackpot Alerts</span>
              </label>

              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={notifications.enableDailyDigest}
                  onChange={(e) =>
                    setNotifications({
                      ...notifications,
                      enableDailyDigest: e.target.checked,
                    })
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
                <span className="text-sm text-gray-900">Daily Digest</span>
              </label>

              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={notifications.enableBonusReminders}
                  onChange={(e) =>
                    setNotifications({
                      ...notifications,
                      enableBonusReminders: e.target.checked,
                    })
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
                <span className="text-sm text-gray-900">Bonus Reminders</span>
              </label>

              <label className="mt-4 flex cursor-pointer items-center gap-3 border-t border-gray-200 pt-4">
                <input
                  type="checkbox"
                  checked={notifications.muted}
                  onChange={(e) =>
                    setNotifications({
                      ...notifications,
                      muted: e.target.checked,
                    })
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
                <span className="text-sm font-medium text-gray-900">Mute All Notifications</span>
              </label>
            </div>
          </div>

          {/* Privacy Info */}
          <div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
            <div className="text-sm text-blue-900">
              <strong>Privacy:</strong> Your data is encrypted locally. Session data is only synced
              to SweepBot servers with your explicit consent.{' '}
              <a
                href="https://sweepbot.app/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold underline"
              >
                Learn more
              </a>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="mt-8 flex gap-3">
          <button
            onClick={handleSave}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white transition hover:bg-blue-700"
          >
            <Save className="h-4 w-4" />
            Save Settings
          </button>

          {saved && (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 px-4 text-green-700">
              ✓ Settings saved
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-12 border-t border-gray-200 pt-6 text-center text-sm text-gray-600">
          <p>SweepBot Extension v0.1.0</p>
          <p className="mt-2">
            Questions? Visit our{' '}
            <a
              href="https://sweepbot.app/support"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              support center
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

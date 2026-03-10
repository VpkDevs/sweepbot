import { useState, useEffect } from 'react'
import { Save, AlertCircle } from 'lucide-react'
import { storage } from '@/lib/storage'
import type { NotificationPreferences } from '@/lib/storage'

export default function OptionsApp() {
  const [hudPosition, setHudPosition] = useState<'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'>('bottom-right')
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
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">SweepBot Settings</h1>
          <p className="text-gray-600 mt-2">Customize your extension experience</p>
        </div>

        {/* Settings Sections */}
        <div className="space-y-6">
          {/* HUD Settings */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">HUD Display</h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="hud-position" className="block text-sm font-medium text-gray-700 mb-2">
                  HUD Position
                </label>
                <select
                  id="hud-position"
                  value={hudPosition}
                  onChange={(e) => setHudPosition(e.target.value as import('@/lib/storage').StorageSchema['hudPosition'])}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Notifications</h2>

            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifications.enableSurgeAlerts}
                  onChange={(e) =>
                    setNotifications({
                      ...notifications,
                      enableSurgeAlerts: e.target.checked,
                    })
                  }
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm text-gray-900">Jackpot Surge Alerts</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifications.enableJackpotAlerts}
                  onChange={(e) =>
                    setNotifications({
                      ...notifications,
                      enableJackpotAlerts: e.target.checked,
                    })
                  }
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm text-gray-900">Near-Hit Jackpot Alerts</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifications.enableDailyDigest}
                  onChange={(e) =>
                    setNotifications({
                      ...notifications,
                      enableDailyDigest: e.target.checked,
                    })
                  }
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm text-gray-900">Daily Digest</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifications.enableBonusReminders}
                  onChange={(e) =>
                    setNotifications({
                      ...notifications,
                      enableBonusReminders: e.target.checked,
                    })
                  }
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm text-gray-900">Bonus Reminders</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer mt-4 pt-4 border-t border-gray-200">
                <input
                  type="checkbox"
                  checked={notifications.muted}
                  onChange={(e) =>
                    setNotifications({
                      ...notifications,
                      muted: e.target.checked,
                    })
                  }
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm font-medium text-gray-900">Mute All Notifications</span>
              </label>
            </div>
          </div>

          {/* Privacy Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <strong>Privacy:</strong> Your data is encrypted locally. Session data is only synced
              to SweepBot servers with your explicit consent.{' '}
              <a href="https://sweepbot.app/privacy" target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                Learn more
              </a>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="mt-8 flex gap-3">
          <button
            onClick={handleSave}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition"
          >
            <Save className="w-4 h-4" />
            Save Settings
          </button>

          {saved && (
            <div className="flex items-center gap-2 text-green-700 bg-green-50 px-4 rounded-lg">
              ✓ Settings saved
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-gray-200 text-center text-sm text-gray-600">
          <p>SweepBot Extension v0.1.0</p>
          <p className="mt-2">
            Questions? Visit our{' '}
            <a href="https://sweepbot.app/support" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              support center
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

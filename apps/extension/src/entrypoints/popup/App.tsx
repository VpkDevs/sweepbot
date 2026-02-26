import { useState, useEffect } from 'react'
import { LogOut, Settings, BarChart3, Zap } from 'lucide-react'
import { storage } from '@/lib/storage'
import type { RtpStats } from '@/lib/rtp-calculator'

export default function PopupApp() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [hudEnabled, setHudEnabled] = useState(false)
  const [sessionStats, setSessionStats] = useState<RtpStats | null>(null)
  const [userEmail, setUserEmail] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadState() {
      setLoading(true)

      // Check auth
      const authToken = await storage.get('authToken')
      const userId = await storage.get('userId')
      setIsAuthenticated(!!authToken && !!userId)

      // Get HUD state
      const hudState = await storage.get('hudEnabled')
      setHudEnabled(hudState ?? true)

      // Get session stats from content script
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (tab.id) {
          const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_SESSION_STATS' })
          if (response?.success) {
            setSessionStats(response.data)
          }
        }
      } catch {
        // Content script not loaded on this tab
      }

      setLoading(false)
    }

    loadState()
  }, [])

  const handleLogout = async () => {
    await chrome.runtime.sendMessage({ type: 'CLEAR_AUTH' })
    setIsAuthenticated(false)
    setUserEmail('')
  }

  const handleHudToggle = async () => {
    const newState = !hudEnabled
    setHudEnabled(newState)
    await storage.set('hudEnabled', newState)

    // Notify content script
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab.id) {
        await chrome.tabs.sendMessage(tab.id, {
          type: 'HUD_TOGGLE',
          payload: { enabled: newState },
        })
      }
    } catch {
      // Content script not available
    }
  }

  const handleOpenDashboard = () => {
    chrome.tabs.create({ url: 'https://app.sweepbot.app/dashboard' })
  }

  if (loading) {
    return (
      <div className="popup-container flex items-center justify-center h-40">
        <div className="text-sm text-gray-500">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="popup-container">
        <div className="p-6">
          <h1 className="text-xl font-bold mb-2 flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded" />
            SweepBot
          </h1>
          <p className="text-sm text-gray-600 mb-4">
            Real-time analytics for sweepstakes casino players
          </p>

          <button
            onClick={() => chrome.tabs.create({ url: 'https://app.sweepbot.app/sign-in' })}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition"
          >
            Sign In
          </button>

          <button
            onClick={() => chrome.tabs.create({ url: 'https://app.sweepbot.app/sign-up' })}
            className="w-full mt-2 bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold py-2 rounded-lg transition"
          >
            Create Account
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="popup-container">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            <h1 className="font-bold">SweepBot</h1>
          </div>
          <button
            onClick={handleLogout}
            className="hover:opacity-80 transition"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Session Stats */}
      {sessionStats ? (
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Current Session</h2>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 p-2 rounded">
              <div className="text-xs text-gray-600">Spins</div>
              <div className="text-lg font-bold text-gray-900">{sessionStats.spinCount}</div>
            </div>

            <div className="bg-gray-50 p-2 rounded">
              <div className="text-xs text-gray-600">RTP</div>
              <div
                className="text-lg font-bold"
                style={{
                  color:
                    sessionStats.rtp > 95
                      ? '#22c55e'
                      : sessionStats.rtp > 85
                        ? '#f59e0b'
                        : '#ef4444',
                }}
              >
                {sessionStats.rtp.toFixed(2)}%
              </div>
            </div>

            <div className="bg-gray-50 p-2 rounded">
              <div className="text-xs text-gray-600">Wagered</div>
              <div className="text-lg font-bold text-gray-900">
                {(sessionStats.totalWagered || 0).toFixed(0)}
              </div>
            </div>

            <div className="bg-gray-50 p-2 rounded">
              <div className="text-xs text-gray-600">Volatility</div>
              <div className="text-lg font-bold text-gray-900 capitalize">
                {sessionStats.volatility}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 border-b border-gray-200 text-center text-sm text-gray-500">
          No active session detected
        </div>
      )}

      {/* Controls */}
      <div className="p-4 space-y-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={hudEnabled}
            onChange={handleHudToggle}
            className="w-4 h-4 rounded border-gray-300"
          />
          <span className="text-sm font-medium text-gray-900">Show HUD Overlay</span>
        </label>

        <button
          onClick={handleOpenDashboard}
          className="w-full flex items-center justify-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold py-2 rounded-lg transition"
        >
          <BarChart3 className="w-4 h-4" />
          Open Dashboard
        </button>

        <button
          onClick={() => chrome.runtime.openOptionsPage()}
          className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2 rounded-lg transition"
        >
          <Settings className="w-4 h-4" />
          Settings
        </button>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-200 text-xs text-gray-500 text-center">
        <p>Version 0.1.0</p>
        <a href="https://sweepbot.app" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
          Learn more
        </a>
      </div>
    </div>
  )
}

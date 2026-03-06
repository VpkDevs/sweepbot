import { useState, useEffect } from 'react'
import { LogOut, Settings, BarChart3, Zap, Cpu, Search } from 'lucide-react'
import { storage } from '@/lib/storage'
import type { RtpStats } from '@/lib/rtp-calculator'
import FlowsTab from './FlowsTab'
import PlatformCaptureTab from './PlatformCaptureTab'

type ActiveTab = 'hud' | 'flows' | 'capture'

/**
 * Render the extension popup UI and manage authentication state, HUD visibility, session data, and tab navigation.
 *
 * This component initializes and persists UI state (authentication, `hudEnabled`, active tab), queries the active
 * tab for session statistics, and communicates with the background script and content scripts via `chrome.runtime`
 * and `chrome.tabs` messages to toggle the HUD and clear authentication. It also provides the HUD and Flows views,
 * sign-in/sign-up flows when unauthenticated, and controls for opening the dashboard and settings.
 *
 * @returns The rendered popup UI element
 */
export default function PopupApp() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('hud')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [hudEnabled, setHudEnabled] = useState(false)
  const [sessionStats, setSessionStats] = useState<RtpStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadState() {
      setLoading(true)

      const authToken = await storage.get('authToken')
      const userId = await storage.get('userId')
      setIsAuthenticated(!!authToken && !!userId)

      const hudState = await storage.get('hudEnabled')
      setHudEnabled(hudState ?? true)

      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (tab.id) {
          const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_SESSION_STATS' })
          if (response?.success) setSessionStats(response.data)
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
  }

  const handleHudToggle = async () => {
    const newState = !hudEnabled
    setHudEnabled(newState)
    await storage.set('hudEnabled', newState)
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

  // ── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="popup-container flex items-center justify-center h-40">
        <div className="text-sm text-gray-500">Loading...</div>
      </div>
    )
  }

  // ── Unauthenticated ──────────────────────────────────────────────────────

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

        <div className="border-t border-gray-200 p-4">
          <PlatformCaptureTab />
        </div>
      </div>
    )
  }

  // ── Authenticated ────────────────────────────────────────────────────────

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

        {/* Tab bar */}
        <div className="flex gap-1 mt-3">
          <button
            onClick={() => setActiveTab('hud')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-semibold transition ${
              activeTab === 'hud'
                ? 'bg-white/20 text-white'
                : 'text-white/60 hover:text-white/80'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            HUD
          </button>
          <button
            onClick={() => setActiveTab('flows')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-semibold transition ${
              activeTab === 'flows'
                ? 'bg-white/20 text-white'
                : 'text-white/60 hover:text-white/80'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            Flows
          </button>
          <button
            onClick={() => setActiveTab('capture')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-semibold transition ${
              activeTab === 'capture'
                ? 'bg-white/20 text-white'
                : 'text-white/60 hover:text-white/80'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            Capture
          </button>
        </div>
      </div>

      {/* ── HUD Tab ──────────────────────────────────────────────────────── */}
      {activeTab === 'hud' && (
        <>
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
              onClick={() => chrome.tabs.create({ url: 'https://app.sweepbot.app/dashboard' })}
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
        </>
      )}

      {/* ── Flows Tab ────────────────────────────────────────────────────── */}
      {activeTab === 'flows' && <FlowsTab />}

      {/* ── Capture Tab ─────────────────────────────────────────────────── */}
      {activeTab === 'capture' && <PlatformCaptureTab />}

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-200 text-xs text-gray-500 text-center">
        <p>Version 0.1.0 &middot;{' '}
          <a href="https://sweepbot.app" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
            sweepbot.app
          </a>
        </p>
      </div>
    </div>
  )
}

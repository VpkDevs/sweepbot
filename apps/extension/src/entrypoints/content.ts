/**
 * Content script.
 * Injected into sweepstakes casino pages.
 * Monitors gameplay, intercepts transactions, and injects HUD overlay.
 */

import { defineContentScript } from 'wxt/sandbox'
import { detectPlatform, isGamePage, isSignupPage } from '@/lib/platforms'
import { networkInterceptor } from '@/lib/interceptor'
import { rtpCalculator } from '@/lib/rtp-calculator'
import { affiliateManager } from '@/lib/affiliate'
import { storage } from '@/lib/storage'
import { extensionApi } from '@/lib/api'
import type { ContentScriptMessage } from '@/types/extension'

export default defineContentScript({
  matches: ['*://*.chumbacasino.com/*', '*://*.luckyland.com/*', '*://*.stake.us/*', '*://*.pulsz.com/*', '*://*.wowvegas.com/*', '*://*.fortunecoins.com/*', '*://*.funrize.com/*', '*://*.zulacasino.com/*', '*://*.crowncoinscasino.com/*', '*://*.mcluck.com/*', '*://*.nolimitcoins.com/*', '*://*.modocasino.com/*', '*://*.globalpoker.com/*', '*://*.high5casino.com/*'],
  main() {

// Initialize
let currentPlatform = detectPlatform(window.location.href)
let currentSessionId: string | null = null
let hudContainerId = 'sweepbot-hud-container'

async function init(): Promise<void> {
  if (!currentPlatform) {
    console.log('[Content] Not a known sweepstakes platform')
    return
  }

  console.log(`[Content] Initialized on ${currentPlatform.name}`)

  // Check if user is authenticated
  const authToken = await storage.get('authToken')
  if (!authToken) {
    console.log('[Content] User not authenticated, skipping gameplay tracking')
    return
  }

  const hudEnabled = await storage.get('hudEnabled')

  // If on a game page, start session
  if (isGamePage(window.location.href, currentPlatform)) {
    startSession()
  }

  // If on signup page, inject affiliate link/banner
  if (isSignupPage(window.location.href, currentPlatform)) {
    injectAffiliateContent()
  }

  // Initialize network interceptor
  networkInterceptor.initialize(currentPlatform)

  networkInterceptor.onTransactionDetected(async (tx) => {
    rtpCalculator.recordSpin(tx.betAmount, tx.winAmount)

    if (currentSessionId) {
      try {
        await extensionApi.recordTransaction(currentSessionId, {
          game_id: tx.gameId,
          bet_amount: tx.betAmount,
          win_amount: tx.winAmount,
          result: tx.result,
        })
      } catch (error) {
        console.error('[Content] Failed to record transaction:', error)
      }
    }

    // Update HUD if visible
    if (hudEnabled) {
      updateHudStats()
    }
  })

  networkInterceptor.onBalanceDetected(async (balance) => {
    if (currentSessionId) {
      try {
        await extensionApi.updateSessionBalance(currentSessionId, balance.scBalance, balance.gcBalance)
      } catch (error) {
        console.error('[Content] Failed to update session balance:', error)
      }
    }
  })

  // Inject HUD if enabled
  if (hudEnabled) {
    injectHud()
  }

  // Listen for messages from background/popup
  chrome.runtime.onMessage.addListener((message: ContentScriptMessage, sender, sendResponse) => {
    handleContentMessage(message)
      .then((result) => sendResponse({ success: true, data: result }))
      .catch((error) => sendResponse({ success: false, error: String(error) }))
    return true
  })
}

/**
 * Start a new session
 */
async function startSession(): Promise<void> {
  if (!currentPlatform) return

  try {
    // Get the game ID from the page (platform-specific)
    const gameId = extractGameId() || 'unknown'

    const result = await extensionApi.createSession(currentPlatform.slug, gameId)
    currentSessionId = result.sessionId

    rtpCalculator.reset()

    console.log(`[Content] Session started: ${currentSessionId}`)

    // Store session data
    await storage.set('sessionData', {
      sessionId: currentSessionId,
      platformSlug: currentPlatform.slug,
      startedAt: Date.now(),
      coinsStart: { sc: 0, gc: 0 },
      coinsCurrent: { sc: 0, gc: 0 },
      transactionCount: 0,
      lastActivityAt: Date.now(),
    })
  } catch (error) {
    console.error('[Content] Failed to start session:', error)
  }
}

/**
 * End the current session
 */
async function endSession(): Promise<void> {
  if (!currentSessionId) return

  try {
    const result = await extensionApi.endSession(currentSessionId)
    console.log(`[Content] Session ended. Final RTP: ${result.rtp.toFixed(2)}%`)
    currentSessionId = null
    await storage.set('sessionData', null)
  } catch (error) {
    console.error('[Content] Failed to end session:', error)
  }
}

/**
 * Extract game ID from page (platform-specific implementation)
 */
function extractGameId(): string | null {
  // This would be customized per platform
  // For now, try to get from URL or page data
  const match = window.location.pathname.match(/\/(games?|play)\/([a-z0-9_-]+)/i)
  return match ? match[2] : null
}

/**
 * Inject HUD overlay
 */
function injectHud(): void {
  // Create container
  const container = document.createElement('div')
  container.id = hudContainerId
  container.innerHTML = `
    <div class="sweepbot-hud" style="
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 320px;
      background: rgba(20, 25, 40, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: white;
      z-index: 999999;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(10px);
    ">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h3 style="margin: 0; font-size: 14px; font-weight: 600;">SweepBot</h3>
        <button class="sweepbot-hud-close" style="
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.6);
          cursor: pointer;
          font-size: 18px;
          padding: 0;
        ">✕</button>
      </div>

      <div style="font-size: 12px; line-height: 1.6; color: rgba(255, 255, 255, 0.8);">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span>Spins:</span>
          <strong class="sweepbot-spin-count">0</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span>RTP:</span>
          <strong class="sweepbot-rtp" style="color: #22c55e;">--</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span>Largest Win:</span>
          <strong class="sweepbot-largest-win">0</strong>
        </div>
        <div style="height: 1px; background: rgba(255, 255, 255, 0.1); margin: 8px 0;"></div>
        <div style="display: flex; justify-content: space-between;">
          <span>Volatility:</span>
          <strong class="sweepbot-volatility">--</strong>
        </div>
      </div>
    </div>
  `

  document.body.appendChild(container)

  // Set up close button
  const closeBtn = container.querySelector('.sweepbot-hud-close') as HTMLButtonElement
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      container.remove()
      storage.set('hudEnabled', false)
    })
  }
}

/**
 * Update HUD stats
 */
function updateHudStats(): void {
  const stats = rtpCalculator.calculate()
  const container = document.getElementById(hudContainerId)

  if (!container) return

  const spinCount = container.querySelector('.sweepbot-spin-count') as HTMLElement
  const rtp = container.querySelector('.sweepbot-rtp') as HTMLElement
  const largestWin = container.querySelector('.sweepbot-largest-win') as HTMLElement
  const volatility = container.querySelector('.sweepbot-volatility') as HTMLElement

  if (spinCount) spinCount.textContent = stats.spinCount.toString()
  if (rtp) {
    rtp.textContent = `${stats.rtp.toFixed(2)}%`
    // Color code RTP: green > 95%, yellow 85-95%, red < 85%
    if (stats.rtp > 95) rtp.style.color = '#22c55e'
    else if (stats.rtp > 85) rtp.style.color = '#f59e0b'
    else rtp.style.color = '#ef4444'
  }
  if (largestWin) largestWin.textContent = stats.largestWin.toString()
  if (volatility) volatility.textContent = stats.volatility.charAt(0).toUpperCase() + stats.volatility.slice(1)
}

/**
 * Inject affiliate content on signup pages
 */
async function injectAffiliateContent(): Promise<void> {
  if (!currentPlatform) return

  try {
    // Try to inject affiliate link/banner
    await affiliateManager.injectAffiliateBanner(currentPlatform)
  } catch (error) {
    console.error('[Content] Failed to inject affiliate banner:', error)
  }
}

/**
 * Handle messages from background/popup
 */
async function handleContentMessage(message: ContentScriptMessage): Promise<unknown> {
  switch (message.type) {
    case 'GET_SESSION_STATS': {
      const stats = rtpCalculator.calculate()
      return stats
    }

    case 'HUD_TOGGLE': {
      const { enabled } = message.payload || {}
      if (enabled) {
        injectHud()
      } else {
        document.getElementById(hudContainerId)?.remove()
      }
      await storage.set('hudEnabled', enabled ?? false)
      return { success: true }
    }

    default:
      return null
  }
}

// Monitor navigation
let lastUrl = window.location.href
setInterval(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href
    console.log('[Content] Navigation detected:', lastUrl)

    // End previous session
    if (currentSessionId) {
      endSession()
    }

    // Re-initialize on new page
    currentPlatform = detectPlatform(lastUrl)
    if (currentPlatform && isGamePage(lastUrl, currentPlatform)) {
      startSession()
    }
  }
}, 1000)

// Initialize on load
init().catch((error) => {
  console.error('[Content] Initialization failed:', error)
})

  } // end main
}) // end defineContentScript

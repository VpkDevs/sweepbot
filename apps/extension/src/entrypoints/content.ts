/**
 * Content script.
 * Injected into sweepstakes casino pages.
 * Monitors gameplay, intercepts transactions, injects HUD overlay,
 * and executes Flow automations on behalf of the background service worker.
 */

import { defineContentScript } from 'wxt/sandbox'
import { detectPlatform, isGamePage, isSignupPage } from '@/lib/platforms'
import { networkInterceptor } from '@/lib/interceptor'
import { rtpCalculator } from '@/lib/rtp-calculator'
import { affiliateManager } from '@/lib/affiliate'
import { storage } from '@/lib/storage'
import { extensionApi } from '@/lib/api'
import { executeFlow } from '@/lib/flows/automation-executor'
import type { ContentScriptMessage } from '@/types/extension'

export default defineContentScript({
  matches: ['*://*.chumbacasino.com/*', '*://*.luckyland.com/*', '*://*.stake.us/*', '*://*.pulsz.com/*', '*://*.wowvegas.com/*', '*://*.fortunecoins.com/*', '*://*.funrize.com/*', '*://*.zulacasino.com/*', '*://*.crowncoinscasino.com/*', '*://*.mcluck.com/*', '*://*.nolimitcoins.com/*', '*://*.modocasino.com/*', '*://*.globalpoker.com/*', '*://*.high5casino.com/*'],
  main() {

// ── State ──────────────────────────────────────────────────────────────────

let currentPlatform = detectPlatform(window.location.href)
let currentSessionId: string | null = null
let hudContainerId = 'sweepbot-hud-container'
let activeFlowId: string | null = null

/**
 * Initialize the content script: validate platform and authentication, start or end sessions based on page type, set up network interception and handlers, inject the HUD or affiliate content as appropriate, and register the runtime message listener for HUD and flow messages.
 *
 * Sets up transaction and balance handlers that update the RTP calculator and forward session updates to the background extension API when a session is active. Also initializes the HUD state if enabled and wires incoming ContentScriptMessage handling to `handleContentMessage`.
 */

async function init(): Promise<void> {
  if (!currentPlatform) {
    console.log('[Content] Not a known sweepstakes platform')
    return
  }

  console.log(`[Content] Initialized on ${currentPlatform.name}`)

  const authToken = await storage.get('authToken')
  if (!authToken) {
    console.log('[Content] User not authenticated, skipping gameplay tracking')
    return
  }

  const hudEnabled = await storage.get('hudEnabled')

  if (isGamePage(window.location.href, currentPlatform)) {
    startSession()
  }

  if (isSignupPage(window.location.href, currentPlatform)) {
    injectAffiliateContent()
  }

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

    if (hudEnabled) updateHudStats()
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

  if (hudEnabled) injectHud()

  // Message listener — handles both HUD messages and flow execution
  chrome.runtime.onMessage.addListener((message: ContentScriptMessage, sender, sendResponse) => {
    handleContentMessage(message)
      .then((result) => sendResponse({ success: true, data: result }))
      .catch((error) => sendResponse({ success: false, error: String(error) }))
    return true
  })
}

/**
 * Starts a new gameplay session for the detected platform and persists its initial metadata.
 *
 * Initializes session state by creating a session with the background service, storing the returned session id, resetting RTP tracking, and persisting session metadata (start time, initial/current coin counters, transaction count, and last activity timestamp).
 *
 * No operation is performed if no platform is detected.
 */

async function startSession(): Promise<void> {
  if (!currentPlatform) return

  try {
    const gameId = extractGameId() || 'unknown'
    const result = await extensionApi.createSession(currentPlatform.slug, gameId)
    currentSessionId = result.sessionId
    rtpCalculator.reset()
    console.log(`[Content] Session started: ${currentSessionId}`)

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
 * Ends the current active session by requesting the backend to close it and clears local session state.
 *
 * If no session is active, this function does nothing. On success it clears the in-memory session identifier and removes persisted session data. Errors are caught and logged.
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
 * Extracts a game identifier from the current page's URL path.
 *
 * @returns The game id found in the path (e.g., segment after `/game` or `/play`), or `null` if no game id is present.
 */
function extractGameId(): string | null {
  const match = window.location.pathname.match(/\/(games?|play)\/([a-z0-9_-]+)/i)
  return match ? match[2] : null
}

/**
 * Injects the SweepBot HUD overlay into the current page.
 *
 * The HUD is appended to document.body using the global `hudContainerId` and includes
 * elements for displaying spins, RTP, largest win, and volatility (classes:
 * `sweepbot-spin-count`, `sweepbot-rtp`, `sweepbot-largest-win`, `sweepbot-volatility`).
 * Adds a close button that removes the HUD and persists `hudEnabled = false` to storage.
 */

function injectHud(): void {
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
          background: none; border: none; color: rgba(255, 255, 255, 0.6);
          cursor: pointer; font-size: 18px; padding: 0;
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

  const closeBtn = container.querySelector('.sweepbot-hud-close') as HTMLButtonElement
  closeBtn?.addEventListener('click', () => {
    container.remove()
    storage.set('hudEnabled', false)
  })
}

/**
 * Update the in-page HUD with the latest session statistics.
 *
 * If the HUD container exists, updates its spin count, RTP (formatted to two decimal places with a trailing '%' and color-coded by value), largest win, and volatility (capitalized). If the HUD container is not present, the function is a no-op.
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
    rtp.style.color = stats.rtp > 95 ? '#22c55e' : stats.rtp > 85 ? '#f59e0b' : '#ef4444'
  }
  if (largestWin) largestWin.textContent = stats.largestWin.toString()
  if (volatility) volatility.textContent = stats.volatility.charAt(0).toUpperCase() + stats.volatility.slice(1)
}

/**
 * Injects the platform-specific affiliate banner into the page.
 *
 * If no platform is detected, this function is a no-op. Errors during injection are caught and logged to the console.
 */

async function injectAffiliateContent(): Promise<void> {
  if (!currentPlatform) return
  try {
    await affiliateManager.injectAffiliateBanner(currentPlatform)
  } catch (error) {
    console.error('[Content] Failed to inject affiliate banner:', error)
  }
}

/**
 * Handle a content-script message and perform the requested action (HUD toggle, session stats, flow control).
 *
 * Supports:
 * - `GET_SESSION_STATS`: returns current RTP/session statistics.
 * - `HUD_TOGGLE`: injects or removes the HUD and persists the setting; returns an acknowledgement object.
 * - `EXECUTE_FLOW`: starts the given flow in the background (prevents concurrent runs), reports completion to the background service worker, and returns an immediate acknowledgement.
 * - `FLOW_CANCEL`: signals cancellation for the active flow via a window event and returns an acknowledgement.
 *
 * Side effects include injecting/removing HUD elements, starting background flow execution, dispatching a cancel event for flows, and sending `FLOW_COMPLETED` messages to the background.
 *
 * @param message - The content script message describing the action to perform and any associated payload.
 * @returns The result of the handled message: session stats for `GET_SESSION_STATS`; acknowledgement objects such as `{ success: true }` or `{ success: false, error: string }` for HUD and flow actions; or `null` for unknown message types.
 */

async function handleContentMessage(message: ContentScriptMessage): Promise<unknown> {
  switch (message.type) {

    case 'GET_SESSION_STATS': {
      return rtpCalculator.calculate()
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

    // ── Flow execution ────────────────────────────────────────────────────

    case 'EXECUTE_FLOW': {
      const { flow } = message.payload!
      if (activeFlowId) {
        console.warn(`[Content] Flow ${activeFlowId} already running — ignoring new request`)
        return { success: false, error: 'A flow is already running' }
      }

      activeFlowId = flow.id
      console.log(`[Content] Executing flow "${flow.name}" (${flow.id})`)

      // Execute in the background so we can return immediately
      executeFlow(flow)
        .then((execution) => {
          activeFlowId = null
          const success = execution.status === 'completed'
          console.log(`[Content] Flow ${flow.id} finished: ${execution.status}`, execution.error ?? '')

          // Report result back to background service worker
          chrome.runtime.sendMessage({
            type: 'FLOW_COMPLETED',
            payload: {
              flowId: flow.id,
              success,
              error: execution.error,
            },
          }).catch(() => {/* background may not be listening */})
        })
        .catch((err) => {
          activeFlowId = null
          const errMsg = err instanceof Error ? err.message : String(err)
          console.error(`[Content] Flow ${flow.id} threw:`, err)

          chrome.runtime.sendMessage({
            type: 'FLOW_COMPLETED',
            payload: { flowId: flow.id, success: false, error: errMsg },
          }).catch(() => {})
        })

      return { success: true, message: 'Flow execution started' }
    }

    case 'FLOW_CANCEL': {
      const { flowId } = message.payload!
      if (activeFlowId === flowId) {
        // The executor checks a cancel flag — we set it via a window event
        window.dispatchEvent(new CustomEvent('sweepbot:cancel-flow', { detail: { flowId } }))
        activeFlowId = null
        console.log(`[Content] Flow ${flowId} cancelled`)
      }
      return { success: true }
    }

    default:
      return null
  }
}

// ── Navigation monitoring ──────────────────────────────────────────────────

let lastUrl = window.location.href
setInterval(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href
    console.log('[Content] Navigation detected:', lastUrl)

    if (currentSessionId) endSession()

    currentPlatform = detectPlatform(lastUrl)
    if (currentPlatform && isGamePage(lastUrl, currentPlatform)) {
      startSession()
    }
  }
}, 1000)

// ── Kick off ───────────────────────────────────────────────────────────────

init().catch((error) => {
  console.error('[Content] Initialization failed:', error)
})

  } // end main
}) // end defineContentScript

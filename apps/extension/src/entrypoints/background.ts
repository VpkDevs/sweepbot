/**
 * Background service worker.
 * Manages extension state, handles message passing, and coordinates data sync.
 * Also handles Flow scheduling via Chrome Alarms and dispatch to content scripts.
 */

import { defineBackground } from 'wxt/sandbox'
import { storage } from '@/lib/storage'
import { flowStorage } from '@/lib/flows/storage'
import { scheduleFlow, unscheduleFlow, isFlowAlarm, getFlowIdFromAlarm } from '@/lib/flows/alarm-scheduler'
import { createLogger } from '@/lib/logger'
import type { BackgroundMessage, MessageResponse } from '@/types/extension'
import type { NavigateStep } from '@/lib/flows/types'

const log = createLogger('Background')

export default defineBackground(() => {

// ── Initialization ──────────────────────────────────────────────────────────

storage.init().catch((error) => {
  log.error('Failed to initialize storage', { error })
})

// Rehydrate Chrome alarms for any active scheduled flows on startup
reactivateScheduledFlows()

// ── Message handler ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (message: BackgroundMessage, sender: chrome.runtime.MessageSender, sendResponse: (response: MessageResponse) => void) => {
    handleMessage(message, sender)
      .then((data) => sendResponse({ success: true, data }))
      .catch((error) => sendResponse({ success: false, error: String(error) }))
    return true // Async response
  },
)

/**
 * Handle an incoming background message and perform the requested operation (authentication, analytics, flow management, or notifications).
 *
 * @param message - The background message to handle; its `type` determines the performed action and expected `payload`.
 * @param _sender - The runtime message sender (originating tab or extension component).
 * @returns The response for the handled message; structure varies by message type — for example, auth state objects, `{ success: true | false }` results with optional `error` or `eventCount`, or an array of flows.
 * @throws Error if `message.type` is not recognized.
 */
async function handleMessage(message: BackgroundMessage, _sender: chrome.runtime.MessageSender): Promise<unknown> {
  switch (message.type) {

    // ── Auth ──────────────────────────────────────────────────────────────

    case 'GET_AUTH_STATE': {
      const authToken = await storage.get('authToken')
      const userId = await storage.get('userId')
      const userRefCode = await storage.get('userRefCode')
      return { authToken, userId, userRefCode, isAuthenticated: !!authToken }
    }

    case 'SET_AUTH_STATE': {
      const { token, userId, refCode } = message.payload!
      await storage.set('authToken', token)
      await storage.set('userId', userId)
      await storage.set('userRefCode', refCode)
      return { success: true }
    }

    case 'CLEAR_AUTH': {
      await storage.set('authToken', null)
      await storage.set('userId', null)
      await storage.set('userRefCode', null)
      return { success: true }
    }

    // ── Analytics ─────────────────────────────────────────────────────────

    case 'LOG_ANALYTICS': {
      await storage.logEvent({
        type: message.payload!['type'] as import('@/lib/storage').AnalyticsEvent['type'],
        platformSlug: message.payload!['platformSlug'] as string,
        timestamp: Date.now(),
        data: message.payload!,
      })
      return { success: true }
    }

    case 'SYNC_TO_SERVER': {
      const events = await storage.get('analyticsEvents')
      if (events && events.length > 0) {
        try {
          log.info('Syncing analytics events to server', { count: events.length })
          // await extensionApi.syncAnalytics(events)
          return { success: true, eventCount: events.length }
        } catch (error) {
          log.error('Failed to sync analytics', { error })    
          return { success: false, error: String(error) }
        }
      }
      return { success: true, eventCount: 0 }
    }

    // ── Flows management ──────────────────────────────────────────────────

    case 'GET_FLOWS': {
      const flows = await flowStorage.getAllFlows()
      return flows
    }

    case 'SAVE_FLOW': {
      const { flow } = message.payload!
      await flowStorage.saveFlow(flow)
      // If active + scheduled, register the Chrome alarm
      if (flow.status === 'active' && flow.trigger.type === 'scheduled') {
        scheduleFlow(flow)
      }
      log.info('Flow saved', { id: flow.id, name: flow.name })
      return { success: true }
    }

    case 'UPDATE_FLOW_STATUS': {
      const { flowId, status } = message.payload!
      await flowStorage.updateFlowStatus(flowId, status)
      const flow = await flowStorage.getFlow(flowId)
      if (!flow) return { success: false, error: 'Flow not found' }

      if (status === 'active' && flow.trigger.type === 'scheduled') {
        scheduleFlow(flow)
        log.info('Flow reactivated', { flowId })
      } else {
        unscheduleFlow(flowId)
        log.info('Flow unscheduled', { flowId, status })
      }
      return { success: true }
    }

    case 'DELETE_FLOW': {
      const { flowId } = message.payload!
      unscheduleFlow(flowId)
      await flowStorage.deleteFlow(flowId)
      log.info('Flow deleted', { flowId })
      return { success: true }
    }

    case 'EXECUTE_FLOW_NOW': {
      const { flowId } = message.payload!
      const flow = await flowStorage.getFlow(flowId)
      if (!flow) return { success: false, error: 'Flow not found' }
      // Fire and forget — result comes back as FLOW_COMPLETED message
      dispatchFlowToTab(flow).catch((err) =>
        log.error('EXECUTE_FLOW_NOW failed', { flowId, error: err }),
      )
      return { success: true }
    }

    // ── Flow execution feedback from content scripts ───────────────────────

    case 'FLOW_COMPLETED': {
      const { flowId, success: ok, error } = message.payload!
      log.info('Flow completed', { flowId, ok, error: error ?? undefined })
      if (!ok && error) {
        // Surface a notification so the user knows something went wrong
        chrome.notifications.create(`flow-error-${flowId}`, {
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon-48.png'),
          title: 'SweepBot Flow Error',
          message: error,
        })
      }
      return { success: true }
    }

    case 'FLOW_NEED_INPUT': {
      const { flowId, prompt } = message.payload!
      log.info('Flow needs user input', { flowId, prompt })
      // Bring the extension popup / notification to the user's attention
      chrome.notifications.create(`flow-input-${flowId}`, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon-48.png'),
        title: 'SweepBot: Action Required',
        message: prompt,
      })
      return { success: true }
    }

    default:
      throw new Error(`Unknown message type: ${(message as { type: string }).type}`)
  }
}

// ── Alarm listener ──────────────────────────────────────────────────────────

chrome.alarms.create('syncAnalytics', { periodInMinutes: 5 })

chrome.alarms.onAlarm.addListener(async (alarm) => {
  // Analytics sync
  if (alarm.name === 'syncAnalytics') {
    const events = await storage.get('analyticsEvents')
    if (events && events.length > 0) {
      log.info('Periodic analytics sync', { count: events.length })
      // await extensionApi.syncAnalytics(events)
    }
    return
  }

  // Flow execution alarm
  if (isFlowAlarm(alarm.name)) {
    const flowId = getFlowIdFromAlarm(alarm.name)
    if (!flowId) return

    const flow = await flowStorage.getFlow(flowId)
    if (!flow || flow.status !== 'active') {
      log.debug('Skipping alarm for inactive/missing flow', { flowId })
      return
    }

    log.info('Alarm fired for flow', { flowId, name: flow.name })
    dispatchFlowToTab(flow).catch((err) =>
      log.error('Flow alarm execution failed', { flowId, error: err }),
    )
  }
})

// ── Tab update handler ───────────────────────────────────────────────────────

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    chrome.tabs.sendMessage(tabId, { type: 'PAGE_LOADED' }).catch(() => {
      // Content script not loaded on this tab — fine
    })
  }
})

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Rehydrate Chrome alarms for all active scheduled flows on service worker
 * startup (Chrome clears alarms when the service worker restarts).
 */
async function reactivateScheduledFlows(): Promise<void> {
  try {
    const flows = await flowStorage.getAllFlows()
    let count = 0
    for (const flow of flows) {
      if (flow.status === 'active' && flow.trigger.type === 'scheduled') {
        scheduleFlow(flow)
        count++
      }
    }
    if (count > 0) {
      log.info('Reactivated scheduled flows on startup', { count })
    }
  } catch (err) {
    log.error('Failed to reactivate scheduled flows', { error: err })
  }
}

/**
 * Locate or open a browser tab on the flow's target platform and send the flow to its content script for execution.
 *
 * Searches for a Navigate step in the flow to determine a target URL; if found, reuses or opens a tab on that origin and navigates to the target URL as needed. If no Navigate step exists, attempts to find an existing casino tab by known URL patterns. Once a suitable tab is available and loaded, sends an `EXECUTE_FLOW` message with the flow.
 *
 * @param flow - The flow definition to dispatch to a content script.
 * @throws Error - If no suitable tab can be found or opened to execute the flow.
 */
async function dispatchFlowToTab(flow: import('@/lib/flows/types').FlowDefinition): Promise<void> {
  // Derive the target URL from the first NavigateStep in the flow
  const navigateStep = flow.steps.find((s) => s.type === 'navigate') as NavigateStep | undefined
  const targetUrl = navigateStep?.url

  let tabId: number | undefined

  if (targetUrl) {
    const origin = new URL(targetUrl).origin
    // Prefer a tab that's already on this platform
    const existing = await chrome.tabs.query({ url: `${origin}/*` })
    if (existing.length > 0 && existing[0].id !== null && existing[0].id !== undefined) {
      tabId = existing[0].id
      // Navigate if not already at the right URL (e.g. on a different game page)
      if (!existing[0].url?.startsWith(targetUrl)) {
        await chrome.tabs.update(tabId, { url: targetUrl })
        await waitForTabLoad(tabId!)
      }
    } else {
      // Open a new tab and wait for it to load
      const tab = await chrome.tabs.create({ url: targetUrl })
      const newTabId = tab.id ?? 0
      tabId = newTabId
      await waitForTabLoad(newTabId)
    }
  } else {
    // No navigate step — try to find any active casino tab
    const casinoUrls = [
      '*://*.chumbacasino.com/*', '*://*.luckyland.com/*', '*://*.stake.us/*',
      '*://*.pulsz.com/*', '*://*.wowvegas.com/*', '*://*.fortunecoins.com/*',
    ]
    for (const pattern of casinoUrls) {
      const tabs = await chrome.tabs.query({ url: pattern })
      if (tabs.length > 0 && tabs[0].id !== null && tabs[0].id !== undefined) {
        tabId = tabs[0].id
        break
      }
    }
  }

  if (tabId === null || tabId === undefined) {
    throw new Error('No suitable tab found to execute flow')
  }

  // Dispatch the flow to the content script
  await chrome.tabs.sendMessage(tabId, {
    type: 'EXECUTE_FLOW',
    payload: { flow },
  })

  log.debug('Dispatched flow to tab', { name: flow.name, tabId })
}

/**
 * Resolve when the specified tab reaches loading status "complete".
 *
 * @param tabId - ID of the tab to observe
 * @param timeoutMs - Maximum time in milliseconds to wait before rejecting (default: 30000)
 * @returns Resolves when the tab's status becomes `complete`; rejects with an `Error` if the timeout is reached before completion
 */
function waitForTabLoad(tabId: number, timeoutMs = 30_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener)
      reject(new Error(`Tab ${tabId} did not finish loading within ${timeoutMs}ms`))
    }, timeoutMs)

    /**
     * Handles tab update events for waitForTabLoad and resolves when the given tab reaches 'complete' status.
     *
     * @param id - The id of the tab that was updated
     * @param info - Change information for the tab update (e.g., `status`)
     */
    function listener(id: number, info: chrome.tabs.TabChangeInfo) {
      if (id === tabId && info.status === 'complete') {
        clearTimeout(timer)
        chrome.tabs.onUpdated.removeListener(listener)
        // Small delay to let the content script initialize
        setTimeout(resolve, 800)
      }
    }

    chrome.tabs.onUpdated.addListener(listener)
    // Also check if it's already loaded
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) return
      if (tab.status === 'complete') {
        clearTimeout(timer)
        chrome.tabs.onUpdated.removeListener(listener)
        setTimeout(resolve, 800)
      }
    })
  })
}

}) // end defineBackground

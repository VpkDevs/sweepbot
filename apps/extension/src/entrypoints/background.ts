/**
 * Background service worker.
 * Manages extension state, handles message passing, and coordinates data sync.
 * Also handles Flow scheduling via Chrome Alarms and dispatch to content scripts.
 */

import { defineBackground } from 'wxt/sandbox'
import { storage } from '@/lib/storage'
import { extensionApi } from '@/lib/api'
import { flowStorage } from '@/lib/flows/storage'
import { scheduleFlow, unscheduleFlow, isFlowAlarm, getFlowIdFromAlarm } from '@/lib/flows/alarm-scheduler'
import type { BackgroundMessage, MessageResponse } from '@/types/extension'
import type { NavigateStep } from '@/lib/flows/types'

export default defineBackground(() => {

// ── Initialization ──────────────────────────────────────────────────────────

storage.init().catch((error) => {
  console.error('[Background] Failed to initialize storage:', error)
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

async function handleMessage(message: BackgroundMessage, sender: chrome.runtime.MessageSender): Promise<unknown> {
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
        type: message.payload!.type as any,
        platformSlug: message.payload!.platformSlug as string,
        timestamp: Date.now(),
        data: message.payload!,
      })
      return { success: true }
    }

    case 'SYNC_TO_SERVER': {
      const events = await storage.get('analyticsEvents')
      if (events && events.length > 0) {
        try {
          console.log(`[Background] Syncing ${events.length} analytics events to server`)
          // await extensionApi.syncAnalytics(events)
          return { success: true, eventCount: events.length }
        } catch (error) {
          console.error('[Background] Failed to sync analytics:', error)
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
      console.log(`[Background] Flow saved: ${flow.id} "${flow.name}"`)
      return { success: true }
    }

    case 'UPDATE_FLOW_STATUS': {
      const { flowId, status } = message.payload!
      await flowStorage.updateFlowStatus(flowId, status)
      const flow = await flowStorage.getFlow(flowId)
      if (!flow) return { success: false, error: 'Flow not found' }

      if (status === 'active' && flow.trigger.type === 'scheduled') {
        scheduleFlow(flow)
        console.log(`[Background] Flow ${flowId} reactivated`)
      } else {
        unscheduleFlow(flowId)
        console.log(`[Background] Flow ${flowId} unscheduled (status: ${status})`)
      }
      return { success: true }
    }

    case 'DELETE_FLOW': {
      const { flowId } = message.payload!
      unscheduleFlow(flowId)
      await flowStorage.deleteFlow(flowId)
      console.log(`[Background] Flow ${flowId} deleted`)
      return { success: true }
    }

    case 'EXECUTE_FLOW_NOW': {
      const { flowId } = message.payload!
      const flow = await flowStorage.getFlow(flowId)
      if (!flow) return { success: false, error: 'Flow not found' }
      // Fire and forget — result comes back as FLOW_COMPLETED message
      dispatchFlowToTab(flow).catch((err) =>
        console.error(`[Background] EXECUTE_FLOW_NOW failed for ${flowId}:`, err),
      )
      return { success: true }
    }

    // ── Flow execution feedback from content scripts ───────────────────────

    case 'FLOW_COMPLETED': {
      const { flowId, success: ok, error } = message.payload!
      console.log(`[Background] Flow ${flowId} completed: ${ok ? 'success' : 'error'}`, error ?? '')
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
      console.log(`[Background] Flow ${flowId} needs input: ${prompt}`)
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
      throw new Error(`Unknown message type: ${(message as any).type}`)
  }
}

// ── Alarm listener ──────────────────────────────────────────────────────────

chrome.alarms.create('syncAnalytics', { periodInMinutes: 5 })

chrome.alarms.onAlarm.addListener(async (alarm) => {
  // Analytics sync
  if (alarm.name === 'syncAnalytics') {
    const events = await storage.get('analyticsEvents')
    if (events && events.length > 0) {
      console.log(`[Background] Periodic sync: ${events.length} events`)
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
      console.log(`[Background] Skipping alarm for inactive/missing flow: ${flowId}`)
      return
    }

    console.log(`[Background] Alarm fired for flow: ${flowId} "${flow.name}"`)
    dispatchFlowToTab(flow).catch((err) =>
      console.error(`[Background] Flow alarm execution failed for ${flowId}:`, err),
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
      console.log(`[Background] Reactivated ${count} scheduled flows`)
    }
  } catch (err) {
    console.error('[Background] Failed to reactivate scheduled flows:', err)
  }
}

/**
 * Find or open a tab at the flow's target platform, then dispatch the flow
 * to the content script for execution.
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
    if (existing.length > 0 && existing[0].id != null) {
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
      if (tabs.length > 0 && tabs[0].id != null) {
        tabId = tabs[0].id
        break
      }
    }
  }

  if (tabId == null) {
    throw new Error('No suitable tab found to execute flow')
  }

  // Dispatch the flow to the content script
  await chrome.tabs.sendMessage(tabId, {
    type: 'EXECUTE_FLOW',
    payload: { flow },
  })

  console.log(`[Background] Dispatched flow "${flow.name}" to tab ${tabId}`)
}

/**
 * Wait until a tab's status becomes 'complete'.
 */
function waitForTabLoad(tabId: number, timeoutMs = 30_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener)
      reject(new Error(`Tab ${tabId} did not finish loading within ${timeoutMs}ms`))
    }, timeoutMs)

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

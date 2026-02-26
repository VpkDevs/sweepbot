/**
 * Background service worker.
 * Manages extension state, handles message passing, and coordinates data sync.
 */

import { defineBackground } from 'wxt/sandbox'
import { storage } from '@/lib/storage'
import { extensionApi } from '@/lib/api'
import type { BackgroundMessage, MessageResponse } from '@/types/extension'

export default defineBackground(() => {
// Initialize storage on extension load
storage.init().catch((error) => {
  console.error('[Background] Failed to initialize storage:', error)
})

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener(
  (message: BackgroundMessage, sender: chrome.runtime.MessageSender, sendResponse: (response: MessageResponse) => void) => {
    handleMessage(message, sender)
      .then((data) => sendResponse({ success: true, data }))
      .catch((error) => sendResponse({ success: false, error: String(error) }))
    return true // Async response
  },
)

/**
 * Route and handle incoming messages
 */
async function handleMessage(message: BackgroundMessage, sender: chrome.runtime.MessageSender): Promise<unknown> {
  switch (message.type) {
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
      // Sync local analytics to API
      const events = await storage.get('analyticsEvents')
      if (events && events.length > 0) {
        try {
          // In a real implementation, we'd batch these to the API
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

    default:
      throw new Error(`Unknown message type: ${message.type}`)
  }
}

/**
 * Set up periodic sync (every 5 minutes)
 */
chrome.alarms.create('syncAnalytics', { periodInMinutes: 5 })

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'syncAnalytics') {
    // Trigger sync
    storage.get('analyticsEvents').then((events) => {
      if (events && events.length > 0) {
        console.log(`[Background] Periodic sync: ${events.length} events`)
        // In production: await extensionApi.syncAnalytics(events)
      }
    })
  }
})

/**
 * Handle tab updates (e.g., when user navigates to a platform)
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Notify content script that tab is ready
    chrome.tabs.sendMessage(tabId, { type: 'PAGE_LOADED' }).catch(() => {
      // Content script not loaded on this tab
    })
  }
})
}) // end defineBackground

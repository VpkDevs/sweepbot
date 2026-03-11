import { defineBackground } from 'wxt/sandbox'
import type { BackgroundMessage } from '../types/extension'

export default defineBackground(() => {
  // Handle messages from content scripts
  chrome.runtime.onMessage.addListener((message: BackgroundMessage, _sender, _sendResponse) => {
    switch (message.type) {
      case 'SHOW_NOTIFICATION':
        showNotification(message.payload.title, message.payload.message)
        break
      
      case 'FLOW_COMPLETED':
        handleFlowCompletion(message.payload)
        break
    }
  })

  // Show browser notification
  function showNotification(title: string, message: string) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: '/icon/128.png',
      title,
      message
    })
  }

  // Handle flow completion
  function handleFlowCompletion(payload: { flowId: string; success: boolean; error?: string }) {
    const { flowId, success, error } = payload
    
    if (success) {
      showNotification('Flow Completed', `Flow ${flowId} executed successfully`)
    } else {
      showNotification('Flow Failed', `Flow ${flowId} failed: ${error || 'Unknown error'}`)
    }
  }

  // Badge management
  function updateBadge(text: string, color = '#8b5cf6') {
    chrome.action.setBadgeText({ text })
    chrome.action.setBadgeBackgroundColor({ color })
  }

  // Initialize
  updateBadge('')
})
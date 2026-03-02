/**
 * Extension-specific type definitions.
 */

import type { FlowDefinition, FlowStatus } from '@/lib/flows/types'

export interface ExtensionMessage<T = unknown> {
  type: string
  payload?: T
}

// ── Messages sent TO content scripts ────────────────────────────────────────

export type ContentScriptMessage =
  | { type: 'PAGE_LOADED'; payload?: undefined }
  | { type: 'GET_SESSION_STATS'; payload?: undefined }
  | { type: 'START_SESSION'; payload: { platformSlug: string; gameId: string } }
  | { type: 'END_SESSION'; payload?: undefined }
  | { type: 'TRANSACTION_DETECTED'; payload: { gameId: string; bet: number; win: number; result: 'win' | 'loss' | 'push' } }
  | { type: 'BALANCE_UPDATED'; payload: { scBalance: number; gcBalance: number } }
  | { type: 'HUD_TOGGLE'; payload: { enabled: boolean } }
  | { type: 'HUD_POSITION_CHANGE'; payload: { position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' } }
  // Flows automation
  | { type: 'EXECUTE_FLOW'; payload: { flow: FlowDefinition } }
  | { type: 'FLOW_CANCEL'; payload: { flowId: string } }

// ── Messages sent TO background service worker ───────────────────────────────

export type BackgroundMessage =
  | { type: 'BACKGROUND_READY'; payload?: undefined }
  | { type: 'GET_AUTH_STATE'; payload?: undefined }
  | { type: 'SET_AUTH_STATE'; payload: { token: string; userId: string; refCode: string } }
  | { type: 'CLEAR_AUTH'; payload?: undefined }
  | { type: 'LOG_ANALYTICS'; payload: Record<string, unknown> }
  | { type: 'SYNC_TO_SERVER'; payload?: undefined }
  // Flows management (from popup)
  | { type: 'GET_FLOWS'; payload?: undefined }
  | { type: 'SAVE_FLOW'; payload: { flow: FlowDefinition } }
  | { type: 'UPDATE_FLOW_STATUS'; payload: { flowId: string; status: FlowStatus } }
  | { type: 'DELETE_FLOW'; payload: { flowId: string } }
  | { type: 'EXECUTE_FLOW_NOW'; payload: { flowId: string } }
  // Flows execution feedback (from content script)
  | { type: 'FLOW_COMPLETED'; payload: { flowId: string; success: boolean; error?: string } }
  | { type: 'FLOW_NEED_INPUT'; payload: { flowId: string; prompt: string } }

export interface HudSessionState {
  isActive: boolean
  platformSlug: string
  startedAt: number
  coinsStart: { sc: number; gc: number }
  coinsCurrent: { sc: number; gc: number }
  transactionCount: number
  lastActivityAt: number
  rtp: number
  volatility: 'low' | 'medium' | 'high'
}

export interface HudToastMessage {
  id: string
  type: 'success' | 'warning' | 'error' | 'info'
  title: string
  message: string
  duration?: number
}

export interface MessageResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

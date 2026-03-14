/**
 * Extension message type contracts.
 *
 * All communication between content scripts, popups, and the background
 * service worker flows through typed messages below.  Each direction has
 * its own discriminated union so both sides can narrow safely.
 */

import type { SessionStorageData, SpinEvent } from '../lib/storage'

// ─────────────────────────────────────────────────────────────────────────────
// Content script → Background
// ─────────────────────────────────────────────────────────────────────────────

export type ContentScriptMessage =
  // Page lifecycle
  | { type: 'PAGE_LOADED'; payload: { url: string; platformSlug: string | null } }
  | { type: 'PAGE_UNLOADED'; payload: { url: string } }

  // Session control
  | {
      type: 'SESSION_START'
      payload: {
        platformSlug: string
        gameId?: string
        tabId?: number
        scBalance?: number
        gcBalance?: number
      }
    }
  | { type: 'SESSION_END'; payload: { reason?: 'user' | 'forced' } }
  | { type: 'SESSION_PAUSE' }
  | { type: 'SESSION_RESUME' }

  // In-session events
  | { type: 'SPIN_RECORDED'; payload: SpinEvent }
  | { type: 'BALANCE_UPDATED'; payload: { sc: number; gc: number } }
  | { type: 'GAME_SWITCHED'; payload: { toGameId: string } }
  | {
      type: 'BONUS_STARTED'
      payload: { gameId: string; roundId: string; spinNumber: number }
    }
  | {
      type: 'BONUS_ENDED'
      payload: {
        gameId: string
        roundId: string
        totalBonusWin: number
        bonusSpinCount: number
      }
    }

  // Data / UI
  | { type: 'GET_SESSION_STATE' }
  | { type: 'GET_SESSION_STATS' }
  | { type: 'HUD_TOGGLE'; payload?: { enabled: boolean } }
  | { type: 'EXECUTE_FLOW'; payload: { flow: unknown } }
  | { type: 'FLOW_CANCEL'; payload: { flowId: string } }
  | { type: 'ADD_ANNOTATION'; payload: { text: string; spinNumber?: number } }

// ─────────────────────────────────────────────────────────────────────────────
// Background → Content script / Popup
// ─────────────────────────────────────────────────────────────────────────────

export type BackgroundMessage =
  // Notifications
  | { type: 'SHOW_NOTIFICATION'; payload: { title: string; message: string } }

  // Flow events
  | { type: 'FLOW_COMPLETED'; payload: { flowId: string; success: boolean; error?: string } }

  // Session events pushed to content / popup
  | { type: 'SESSION_STARTED'; payload: { sessionId: string; platformSlug: string } }
  | { type: 'SESSION_ENDED'; payload: { sessionId: string; rtp: number; netResult: number } }
  | { type: 'SESSION_PAUSED'; payload: { sessionId: string; reason: string } }
  | { type: 'SESSION_RESUMED'; payload: { sessionId: string } }
  | { type: 'SESSION_CONTEXT_CHANGED'; payload: { platformSlug: string | null } }

  // Real-time stat pushes to HUD
  | {
      type: 'SESSION_STATS_UPDATE'
      payload: {
        rtp: number
        netResult: number
        spinCount: number
        largestWin: number
        phase: SessionStorageData['phase']
        streakCurrent: number
        streakDirection: 'win' | 'loss' | 'none'
        volatilityIndex: number
        qualityScore: number
        activeMs: number
        bonusTriggers: number
      }
    }

  // Achievements / gamification
  | {
      type: 'PERSONAL_RECORD_BROKEN'
      payload: {
        recordType: string
        newValue: number
        previousValue: number | null
      }
    }
  | {
      type: 'STREAK_MILESTONE'
      payload: { days: number }
    }
  | {
      type: 'BIG_WIN_CELEBRATION'
      payload: {
        multiplier: number
        winAmount: number
        tier: 'big_win' | 'mega_win' | 'epic_win' | 'legendary_win'
      }
    }
  | {
      type: 'BONUS_ROUND_STARTED'
      payload: { gameId: string; spinNumber: number }
    }

// ─────────────────────────────────────────────────────────────────────────────
// Background message response shapes
// ─────────────────────────────────────────────────────────────────────────────

export interface SessionStartResponse {
  success: boolean
  sessionId?: string
  error?: string
}

export interface SessionStateResponse {
  session: SessionStorageData | null
}

export interface SessionStatsResponse {
  rtp: number
  netResult: number
  spinCount: number
  largestWin: number
  durationMinutes: number
  phase: SessionStorageData['phase']
  qualityScore: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy SessionData shape (kept for popup backward compatibility)
// ─────────────────────────────────────────────────────────────────────────────

/** @deprecated Use SessionStorageData from lib/storage instead. */
export type SessionData = {
  sessionId: string
  platformSlug: string
  startedAt: number
  coinsStart: { sc: number; gc: number }
  coinsCurrent: { sc: number; gc: number }
  transactionCount: number
  lastActivityAt: number
}

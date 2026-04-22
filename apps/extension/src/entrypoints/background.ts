/**
 * Sweepbot Background Service Worker
 *
 * Full session orchestration engine responsible for:
 *
 *   ┌─────────────────────────────────────────────────────────────────────┐
 *   │  SessionLifecycleManager                                            │
 *   │   • Start / end / pause / resume sessions via API                  │
 *   │   • Auto-end sessions on platform tab close                         │
 *   │   • Recover orphaned sessions on service-worker restart             │
 *   ├─────────────────────────────────────────────────────────────────────┤
 *   │  TransactionFlushQueue                                              │
 *   │   • Buffers spins locally while offline                             │
 *   │   • Batch-flushes to API when connectivity returns                  │
 *   │   • Exponential back-off on failure (2^n × 5 s, capped at 5 min)   │
 *   ├─────────────────────────────────────────────────────────────────────┤
 *   │  HeartbeatManager                                                   │
 *   │   • chrome.alarms fires every 30 s to keep session alive            │
 *   │   • Writes lastHeartbeatAt into SessionStorageData                  │
 *   │   • Detects and marks stale sessions (no heartbeat for 5 min)       │
 *   ├─────────────────────────────────────────────────────────────────────┤
 *   │  IdleDetector                                                       │
 *   │   • Monitors chrome.idle state (IDLE / LOCKED / ACTIVE)            │
 *   │   • Pauses session timer when user goes idle                        │
 *   │   • Updates totalIdleMs and activeMs in SessionStorageData          │
 *   ├─────────────────────────────────────────────────────────────────────┤
 *   │  BadgeManager                                                       │
 *   │   • Displays live session RTP in the extension badge                │
 *   │   • Green badge: RTP ≥ 95 %  |  Amber: 80–95 %  |  Red: < 80 %    │
 *   ├─────────────────────────────────────────────────────────────────────┤
 *   │  TabMonitor                                                         │
 *   │   • Tracks which tabs are on recognised sweep-casino platforms      │
 *   │   • Fires SESSION_CONTEXT_CHANGED when the active platform changes  │
 *   ├─────────────────────────────────────────────────────────────────────┤
 *   │  MessageRouter                                                      │
 *   │   • Routes all content-script ↔ background messages                │
 *   │   • Replies synchronously or defers to async where needed          │
 *   └─────────────────────────────────────────────────────────────────────┘
 */

import { defineBackground } from 'wxt/sandbox'
import { storage } from '../lib/storage'
import { extensionApi } from '../lib/api'
import { streakTracker } from '../lib/streak-tracker'
import { recordsTracker } from '../lib/records-tracker'
import type {
  SessionStorageData,
  BufferedTransaction,
  BalanceSnapshot,
  SpinEvent,
  SessionPhase,
  SessionAnnotation,
} from '../lib/storage'
import type { BackgroundMessage } from '../types/extension'
import { createLogger } from '../lib/logger'

const log = createLogger('Background')

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const HEARTBEAT_ALARM = 'sweepbot:heartbeat'
const FLUSH_ALARM = 'sweepbot:flush'
const HEARTBEAT_INTERVAL_MINUTES = 0.5 // 30 s
const FLUSH_INTERVAL_MINUTES = 0.25 // 15 s
const IDLE_THRESHOLD_SECONDS = 120 // 2 min before "idle"
const ORPHAN_THRESHOLD_MS = 5 * 60_000 // session with no heartbeat >5 min
const MAX_BATCH_FLUSH_SIZE = 25 // max transactions per API call
const SESSION_AUTO_END_DELAY_MS = 30_000 // wait 30 s after tab closes before ending

// Badge colour thresholds (RTP %)
const BADGE_GREEN_THRESHOLD = 95
const BADGE_AMBER_THRESHOLD = 80

// ─────────────────────────────────────────────────────────────────────────────
// Badge Manager
// ─────────────────────────────────────────────────────────────────────────────

const BadgeManager = {
  async showRTP(rtp: number): Promise<void> {
    const label = rtp > 0 ? `${Math.round(rtp)}%` : ''
    const color =
      rtp >= BADGE_GREEN_THRESHOLD
        ? '#22c55e' // green-500
        : rtp >= BADGE_AMBER_THRESHOLD
          ? '#f59e0b' // amber-500
          : '#ef4444' // red-500
    await chrome.action.setBadgeText({ text: label })
    await chrome.action.setBadgeBackgroundColor({ color })
  },

  async showStatus(symbol: string, color = '#8b5cf6'): Promise<void> {
    await chrome.action.setBadgeText({ text: symbol })
    await chrome.action.setBadgeBackgroundColor({ color })
  },

  async clear(): Promise<void> {
    await chrome.action.setBadgeText({ text: '' })
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Transaction Flush Queue
// ─────────────────────────────────────────────────────────────────────────────

const TransactionFlushQueue = {
  /** True while a flush is in progress (prevents concurrent flushes). */
  _flushing: false,

  /**
   * Flush all pending transactions that are ready for retry.
   * Groups them by sessionId and sends up to MAX_BATCH_FLUSH_SIZE per call.
   */
  async flush(): Promise<void> {
    if (this._flushing) return
    this._flushing = true

    try {
      const session = await storage.get('sessionData')
      if (!session) return

      const now = Date.now()
      const ready = session.transactionBuffer.filter((tx) => !tx.synced && tx.nextRetryAt <= now)
      if (ready.length === 0) return

      // Group by sessionId (should almost always be a single group)
      const bySession = new Map<string, BufferedTransaction[]>()
      for (const tx of ready) {
        const group = bySession.get(tx.sessionId) ?? []
        group.push(tx)
        bySession.set(tx.sessionId, group)
      }

      for (const [sessionId, txs] of bySession) {
        const batch = txs.slice(0, MAX_BATCH_FLUSH_SIZE)
        const localIds = batch.map((tx) => tx.localId)

        try {
          await extensionApi.batchTransactions(
            sessionId,
            batch.map((tx) => ({
              game_id: tx.gameId,
              bet_amount: tx.betAmount,
              win_amount: tx.winAmount,
              result: tx.result,
              bonus_triggered: tx.bonusTriggered,
              jackpot_hit: tx.jackpotHit,
              round_id: tx.roundId,
              timestamp: new Date(tx.timestamp).toISOString(),
            }))
          )
          await storage.markTransactionsSynced(localIds)
          log.info(`Flushed ${batch.length} transactions for session ${sessionId}`)

          await storage.logEvent({
            type: 'sync_success',
            platformSlug: session.platformSlug,
            timestamp: Date.now(),
            data: { count: batch.length, sessionId },
          })
        } catch (err) {
          log.error('Batch flush failed', { err })
          await storage.markTransactionSyncFailed(localIds)
          await storage.logEvent({
            type: 'sync_failure',
            platformSlug: session.platformSlug,
            timestamp: Date.now(),
            data: { count: batch.length, sessionId, error: String(err) },
          })
        }
      }

      // Refresh badge after flush
      const updated = await storage.get('sessionData')
      if (updated) await BadgeManager.showRTP(updated.rtpCurrent)
    } finally {
      this._flushing = false
    }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Heartbeat Manager
// ─────────────────────────────────────────────────────────────────────────────

const HeartbeatManager = {
  async tick(): Promise<void> {
    const session = await storage.get('sessionData')
    if (!session || session.phase === 'idle') return

    const now = Date.now()

    // Detect orphaned session (no heartbeat for >5 min while supposedly active)
    if (
      session.phase !== 'syncing' &&
      session.lastHeartbeatAt > 0 &&
      now - session.lastHeartbeatAt > ORPHAN_THRESHOLD_MS
    ) {
      log.warn('Orphaned session detected — marking as idle', { sessionId: session.sessionId })
      await storage.mutateSession((s) => ({
        ...s,
        phase: 'idle' as SessionPhase,
        phaseChangedAt: now,
        idleStartedAt: s.idleStartedAt ?? now,
      }))
      await BadgeManager.showStatus('⏸', '#6b7280')
      return
    }

    // Normal heartbeat
    await storage.mutateSession((s) => ({ ...s, lastHeartbeatAt: now }))
    await BadgeManager.showRTP(session.rtpCurrent)
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Session Lifecycle Manager
// ─────────────────────────────────────────────────────────────────────────────

const SessionLifecycleManager = {
  /**
   * Create a new session both locally (storage) and remotely (API).
   * Returns the new SessionStorageData or null on failure.
   */
  async startSession(opts: {
    platformSlug: string
    gameId: string | null
    tabId: number | null
    scBalance: number
    gcBalance: number
  }): Promise<SessionStorageData | null> {
    // Guard: only one active session at a time
    const existing = await storage.get('sessionData')
    if (existing && existing.phase !== 'idle') {
      log.warn('Tried to start session while one is active', { existing: existing.sessionId })
      return null
    }

    const now = Date.now()

    // Call API to register the session
    let remoteSessionId: string
    try {
      const res = await extensionApi.createSession(opts.platformSlug, opts.gameId ?? '')
      remoteSessionId = res.sessionId
    } catch (err) {
      log.error('Failed to create remote session', { err })
      return null
    }

    const session: SessionStorageData = {
      sessionId: remoteSessionId,
      platformSlug: opts.platformSlug,
      startedAt: now,
      tabId: opts.tabId,

      gameId: opts.gameId,
      gameSwitches: [],

      coinsStart: { sc: opts.scBalance, gc: opts.gcBalance },
      coinsCurrent: { sc: opts.scBalance, gc: opts.gcBalance },
      balanceHistory: [
        { ts: now, sc: opts.scBalance, gc: opts.gcBalance, source: 'session_start' },
      ],

      spinTimeline: [],
      transactionCount: 0,

      bonusEvents: [],
      bigWins: [],
      inBonusRound: false,
      activeBonusIndex: null,

      rtpSamples: [],
      rtpCurrent: 0,
      volatilityIndex: 0,
      streakSummary: { current: 0, longestWin: 0, longestLoss: 0, direction: 'none' },
      netResult: 0,
      totalWagered: 0,
      totalWon: 0,
      largestWin: 0,
      largestWinSpinNumber: 0,

      phase: 'warmup',
      phaseChangedAt: now,

      lastActivityAt: now,
      idleStartedAt: null,
      totalIdleMs: 0,
      activeMs: 0,
      lastHeartbeatAt: now,

      transactionBuffer: [],
      syncFailureCount: 0,
      lastSyncedAt: 0,
      totalSyncedTransactions: 0,

      sessionQualityScore: 20,
      annotations: [
        {
          ts: now,
          source: 'system',
          text: `Session started on ${opts.platformSlug}${opts.gameId ? ` playing ${opts.gameId}` : ''}.`,
        },
      ],
    }

    await storage.set('sessionData', session)

    // Record the streak
    await streakTracker.recordSession(opts.platformSlug)

    // Badge
    await BadgeManager.showStatus('▶', '#22c55e')

    // Log analytics
    await storage.logEvent({
      type: 'session_start',
      platformSlug: opts.platformSlug,
      timestamp: now,
      data: { sessionId: remoteSessionId, scBalance: opts.scBalance, gcBalance: opts.gcBalance },
    })

    log.info('Session started', { sessionId: remoteSessionId, platform: opts.platformSlug })
    return session
  },

  /**
   * End the active session: flush any buffered transactions, call the API,
   * check personal records, then clear local session state.
   */
  async endSession(reason: 'user' | 'tab_closed' | 'idle_timeout' | 'forced'): Promise<void> {
    const session = await storage.get('sessionData')
    if (!session) return

    const now = Date.now()
    log.info('Ending session', { sessionId: session.sessionId, reason })

    // Flush outstanding transactions first
    await TransactionFlushQueue.flush()

    // Compute final balance if possible
    const closingBalance = session.coinsCurrent

    // Call API to end session
    try {
      const result = await extensionApi.endSession(session.sessionId)
      log.info('Session ended', { rtp: result.rtp, netResult: result.netResult })
    } catch (err) {
      log.error('Failed to end remote session', { err })
    }

    // Check personal records
    const durationMinutes = (now - session.startedAt - session.totalIdleMs) / 60_000
    await recordsTracker.checkAndUpdateRecords({
      biggestWin: session.largestWin,
      rtp: session.rtpCurrent,
      durationMinutes,
      spinCount: session.transactionCount,
      netResult: session.netResult,
      platformSlug: session.platformSlug,
      gameId: session.gameId ?? undefined,
      sessionId: session.sessionId,
    })

    // Increment session counter
    const count = await storage.get('completedSessionCount')
    await storage.set('completedSessionCount', (count ?? 0) + 1)

    // Final annotation
    const finalAnnotation: SessionAnnotation = {
      ts: now,
      source: 'system',
      text: `Session ended (${reason}). RTP: ${session.rtpCurrent.toFixed(1)} %. Net: ${session.netResult >= 0 ? '+' : ''}${session.netResult.toFixed(2)} SC. Duration: ${Math.round(durationMinutes)} min.`,
    }

    // Persist a compact session record in analytics before clearing
    await storage.logEvent({
      type: 'session_end',
      platformSlug: session.platformSlug,
      timestamp: now,
      data: {
        sessionId: session.sessionId,
        rtp: session.rtpCurrent,
        netResult: session.netResult,
        spinCount: session.transactionCount,
        durationMinutes: Math.round(durationMinutes),
        reason,
        largestWin: session.largestWin,
        bonusTriggers: session.bonusEvents.length,
        qualityScore: session.sessionQualityScore,
        closingBalance,
        finalAnnotation,
      },
    })

    await storage.set('sessionData', null)
    await BadgeManager.clear()
  },

  /**
   * Pause the active session (e.g., user went idle).
   */
  async pauseSession(reason: 'idle' | 'user' | 'navigation'): Promise<void> {
    const now = Date.now()
    await storage.mutateSession((s) => ({
      ...s,
      phase: 'idle' as SessionPhase,
      phaseChangedAt: now,
      idleStartedAt: s.idleStartedAt ?? now,
    }))
    await BadgeManager.showStatus('⏸', '#6b7280')
    const session = await storage.get('sessionData')
    if (session) {
      await storage.logEvent({
        type: 'session_paused',
        platformSlug: session.platformSlug,
        timestamp: now,
        data: { reason },
      })
    }
  },

  /**
   * Resume a paused session.
   */
  async resumeSession(): Promise<void> {
    const session = await storage.get('sessionData')
    if (!session || session.phase !== 'idle') return

    const now = Date.now()
    const idleMs = session.idleStartedAt ? now - session.idleStartedAt : 0

    await storage.mutateSession((s) => ({
      ...s,
      phase: s.transactionCount < 20 ? ('warmup' as SessionPhase) : ('active' as SessionPhase),
      phaseChangedAt: now,
      idleStartedAt: null,
      totalIdleMs: s.totalIdleMs + idleMs,
      lastHeartbeatAt: now,
    }))

    await BadgeManager.showRTP(session.rtpCurrent)
    await storage.logEvent({
      type: 'session_resumed',
      platformSlug: session.platformSlug,
      timestamp: now,
      data: { idleMs },
    })
    log.info('Session resumed', { idleMs })
  },

  /**
   * Record a balance update.  Updates coinsCurrent and balanceHistory.
   */
  async recordBalance(sc: number, gc: number, source: BalanceSnapshot['source']): Promise<void> {
    const snapshot: BalanceSnapshot = { ts: Date.now(), sc, gc, source }
    await storage.recordBalance(snapshot)

    // Sync to API if we have a session ID
    const session = await storage.get('sessionData')
    if (session) {
      extensionApi
        .updateSessionBalance(session.sessionId, sc, gc)
        .catch((err) => log.warn('Balance sync failed', { err }))
    }
  },

  /**
   * Record a completed spin.  Enqueues it to the local buffer and
   * immediately attempts a flush if connectivity allows.
   */
  async recordSpin(spin: SpinEvent): Promise<void> {
    await storage.recordSpin(spin)

    const session = await storage.get('sessionData')
    if (!session) return

    // Build a buffered transaction
    const tx: BufferedTransaction = {
      localId: `${spin.ts}-${spin.roundId || crypto.randomUUID()}`,
      sessionId: session.sessionId,
      gameId: spin.gameId,
      roundId: spin.roundId,
      betAmount: spin.bet,
      winAmount: spin.win,
      result: spin.result === 'push' ? 'loss' : spin.result,
      bonusTriggered: spin.bonusTriggered,
      jackpotHit: spin.jackpotHit,
      timestamp: spin.ts,
      retryCount: 0,
      nextRetryAt: Date.now(),
      synced: false,
    }

    await storage.enqueueTransaction(tx)

    // Opportunistic flush every 5 spins
    if (session.transactionCount % 5 === 0) {
      TransactionFlushQueue.flush().catch((e) => log.warn('Opportunistic flush failed', { e }))
    }

    // Badge update
    const updated = await storage.get('sessionData')
    if (updated) {
      await BadgeManager.showRTP(updated.rtpCurrent)
    }
  },

  /**
   * On startup: look for an active session whose last heartbeat is recent
   * (service worker may have been killed and restarted).  If the heartbeat
   * is stale, mark the session as orphaned.
   */
  async recoverOrphanedSessions(): Promise<void> {
    const session = await storage.get('sessionData')
    if (!session) return

    const now = Date.now()
    const staleness = now - session.lastHeartbeatAt

    if (staleness > ORPHAN_THRESHOLD_MS) {
      log.warn('Found orphaned session on startup', {
        sessionId: session.sessionId,
        staleness,
      })
      await storage.mutateSession((s) => ({
        ...s,
        phase: 'idle' as SessionPhase,
        phaseChangedAt: now,
        idleStartedAt: s.idleStartedAt ?? now,
      }))
      await BadgeManager.showStatus('!', '#ef4444')
    } else {
      // Still fresh — resume heartbeat transparently
      await HeartbeatManager.tick()
    }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab Monitor
// ─────────────────────────────────────────────────────────────────────────────

/** Tracks the browser tab the current session is running in. */
const TabMonitor = {
  /** pendingEndTimers keyed by tabId */
  _pendingEnd: new Map<number, ReturnType<typeof setTimeout>>(),

  onTabRemoved(tabId: number): void {
    storage
      .get('sessionData')
      .then((s) => {
        if (!s || s.tabId !== tabId) return
        log.info('Platform tab closed — scheduling session end', { tabId })

        const timer = setTimeout(async () => {
          this._pendingEnd.delete(tabId)
          await SessionLifecycleManager.endSession('tab_closed')
        }, SESSION_AUTO_END_DELAY_MS)

        this._pendingEnd.set(tabId, timer)
      })
      .catch(() => {})
  },

  onTabUpdated(tabId: number, url: string): void {
    // If the tab navigated away from the platform, trigger end with delay
    storage
      .get('sessionData')
      .then(async (s) => {
        if (!s || s.tabId !== tabId) return
        // Could check URL against platform patterns here — for now just track
        // that the platform tab is still alive
        if (this._pendingEnd.has(tabId)) {
          const pendingTimer = this._pendingEnd.get(tabId)
          if (pendingTimer !== undefined) {
            clearTimeout(pendingTimer)
          }
          this._pendingEnd.delete(tabId)
          log.info('Tab navigation — session end timer cancelled', { tabId, url })
        }
      })
      .catch(() => {})
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Message Router
// ─────────────────────────────────────────────────────────────────────────────

type ExtendedBackgroundMessage =
  | BackgroundMessage
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
  | { type: 'SPIN_RECORDED'; payload: SpinEvent }
  | { type: 'BALANCE_UPDATED'; payload: { sc: number; gc: number } }
  | { type: 'GET_SESSION_STATE' }
  | { type: 'ADD_ANNOTATION'; payload: { text: string; spinNumber?: number } }
  | { type: 'GAME_SWITCHED'; payload: { toGameId: string } }

function routeMessage(
  message: ExtendedBackgroundMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
): boolean {
  const tabId = sender.tab?.id ?? null

  switch (message.type) {
    case 'SHOW_NOTIFICATION':
      showNotification(
        (message as BackgroundMessage & { type: 'SHOW_NOTIFICATION' }).payload.title,
        (message as BackgroundMessage & { type: 'SHOW_NOTIFICATION' }).payload.message
      )
      return false

    case 'FLOW_COMPLETED': {
      const p = (message as BackgroundMessage & { type: 'FLOW_COMPLETED' }).payload
      if (p.success) {
        showNotification('Flow Completed', `Flow ${p.flowId} executed successfully`)
      } else {
        showNotification('Flow Failed', `Flow ${p.flowId} failed: ${p.error ?? 'Unknown error'}`)
      }
      return false
    }

    case 'SESSION_START': {
      const p = (
        message as {
          type: 'SESSION_START'
          payload: {
            platformSlug: string
            gameId?: string
            tabId?: number
            scBalance?: number
            gcBalance?: number
          }
        }
      ).payload
      SessionLifecycleManager.startSession({
        platformSlug: p.platformSlug,
        gameId: p.gameId ?? null,
        tabId: p.tabId ?? tabId,
        scBalance: p.scBalance ?? 0,
        gcBalance: p.gcBalance ?? 0,
      }).then((session) => sendResponse({ success: !!session, sessionId: session?.sessionId }))
      return true // async response
    }

    case 'SESSION_END': {
      const p = (message as { type: 'SESSION_END'; payload?: { reason?: 'user' | 'forced' } })
        .payload
      SessionLifecycleManager.endSession(p?.reason ?? 'user').then(() =>
        sendResponse({ success: true })
      )
      return true
    }

    case 'SESSION_PAUSE':
      SessionLifecycleManager.pauseSession('user').then(() => sendResponse({ success: true }))
      return true

    case 'SESSION_RESUME':
      SessionLifecycleManager.resumeSession().then(() => sendResponse({ success: true }))
      return true

    case 'SPIN_RECORDED': {
      const spin = (message as { type: 'SPIN_RECORDED'; payload: SpinEvent }).payload
      SessionLifecycleManager.recordSpin(spin).then(() => sendResponse({ success: true }))
      return true
    }

    case 'BALANCE_UPDATED': {
      const { sc, gc } = (
        message as { type: 'BALANCE_UPDATED'; payload: { sc: number; gc: number } }
      ).payload
      SessionLifecycleManager.recordBalance(sc, gc, 'intercepted').then(() =>
        sendResponse({ success: true })
      )
      return true
    }

    case 'GET_SESSION_STATE':
      storage.get('sessionData').then((s) => sendResponse({ session: s }))
      return true

    case 'ADD_ANNOTATION': {
      const { text, spinNumber } = (
        message as { type: 'ADD_ANNOTATION'; payload: { text: string; spinNumber?: number } }
      ).payload
      storage
        .mutateSession((s) => {
          const annotation: SessionAnnotation = {
            ts: Date.now(),
            source: 'user',
            text,
            spinNumber,
          }
          return { ...s, annotations: [...s.annotations, annotation] }
        })
        .then(() => sendResponse({ success: true }))
      return true
    }

    case 'GAME_SWITCHED': {
      const { toGameId } = (message as { type: 'GAME_SWITCHED'; payload: { toGameId: string } })
        .payload
      storage
        .mutateSession((s) => ({
          ...s,
          gameId: toGameId,
          gameSwitches: [
            ...s.gameSwitches,
            {
              ts: Date.now(),
              fromGameId: s.gameId,
              toGameId,
              spinCountAtSwitch: s.transactionCount,
            },
          ],
        }))
        .then(() => sendResponse({ success: true }))
      return true
    }

    default:
      return false
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function showNotification(title: string, message: string): void {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: '/icon/128.png',
    title,
    message,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

export default defineBackground(async () => {
  log.info('Background service worker started')

  // ── Recover any orphaned session from a previous service-worker run ───────
  await SessionLifecycleManager.recoverOrphanedSessions()

  // ── Set up periodic alarms ─────────────────────────────────────────────
  chrome.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: HEARTBEAT_INTERVAL_MINUTES })
  chrome.alarms.create(FLUSH_ALARM, { periodInMinutes: FLUSH_INTERVAL_MINUTES })

  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === HEARTBEAT_ALARM) {
      await HeartbeatManager.tick()
    } else if (alarm.name === FLUSH_ALARM) {
      await TransactionFlushQueue.flush()
    }
  })

  // ── Idle detection ─────────────────────────────────────────────────────
  chrome.idle.setDetectionInterval(IDLE_THRESHOLD_SECONDS)
  chrome.idle.onStateChanged.addListener(async (state) => {
    log.info('Idle state changed', { state })
    if (state === 'idle' || state === 'locked') {
      await SessionLifecycleManager.pauseSession('idle')
    } else if (state === 'active') {
      await SessionLifecycleManager.resumeSession()
    }
  })

  // ── Tab lifecycle ──────────────────────────────────────────────────────
  chrome.tabs.onRemoved.addListener((tabId) => {
    TabMonitor.onTabRemoved(tabId)
  })

  chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
    if (changeInfo.url && tab.id) {
      TabMonitor.onTabUpdated(tab.id, changeInfo.url)
    }
  })

  // ── Message routing ────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((message: ExtendedBackgroundMessage, sender, sendResponse) =>
    routeMessage(message, sender, sendResponse)
  )

  // ── Storage change watcher: badge reflects any external mutation ───────
  storage.onChanged(async (changes) => {
    if ('sessionData' in changes) {
      const newSession = changes['sessionData']?.newValue as SessionStorageData | null
      if (newSession) {
        await BadgeManager.showRTP(newSession.rtpCurrent)
      } else {
        await BadgeManager.clear()
      }
    }
  })

  // ── Initial badge state ────────────────────────────────────────────────
  const existingSession = await storage.get('sessionData')
  if (existingSession && existingSession.phase !== 'idle') {
    await BadgeManager.showRTP(existingSession.rtpCurrent)
  } else {
    await BadgeManager.clear()
  }

  log.info('Background service worker ready')
})

/**
 * Chrome Storage wrapper — unified local storage for extension state.
 * Wraps chrome.storage.local with type-safe getters/setters.
 *
 * Session collection fields are extremely rich:
 *   - Full balance history timeline
 *   - Per-spin event log for hot/cold streak analysis
 *   - Bonus event catalog
 *   - Big-win ledger (>10× bet)
 *   - Offline-capable transaction buffer with retry metadata
 *   - Idle/active time decomposition
 *   - Real-time RTP convergence samples
 *   - Volatility index
 *   - Session phase state machine
 *   - Multi-game switch tracking within a session
 *   - Session quality score (0-100 data richness)
 *   - User and system annotations
 */
import { createLogger } from './logger'

const log = createLogger('StorageManager')

// ─────────────────────────────────────────────────────────────────────────────
// Session phase state machine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The phase the session is currently in.  Transitions are driven by the
 * background SessionManager and used by the HUD to show contextual advice.
 *
 *   warmup      → first ~20 spins; insufficient sample to judge RTP
 *   active      → steady-state play; full RTP tracking engaged
 *   bonus_round → a bonus feature is actively running; extra win tracking
 *   cooling_down→ player is spending long time between spins; idle approaching
 *   idle        → no spins for IDLE_THRESHOLD_MS; session auto-paused
 *   syncing     → background flush in progress; no new transactions accepted
 */
export type SessionPhase = 'warmup' | 'active' | 'bonus_round' | 'cooling_down' | 'idle' | 'syncing'

// ─────────────────────────────────────────────────────────────────────────────
// Balance snapshot
// ─────────────────────────────────────────────────────────────────────────────

/** A point-in-time balance reading captured from a network response. */
export interface BalanceSnapshot {
  /** Unix ms */
  ts: number
  sc: number
  gc: number
  /** How this snapshot was obtained */
  source: 'intercepted' | 'polled' | 'session_start' | 'session_end'
}

// ─────────────────────────────────────────────────────────────────────────────
// Spin / transaction events
// ─────────────────────────────────────────────────────────────────────────────

/** A single spin result captured by the network interceptor. */
export interface SpinEvent {
  /** Unix ms */
  ts: number
  gameId: string
  roundId: string
  bet: number
  win: number
  /** win/bet ratio; 0 on a loss */
  multiplier: number
  result: 'win' | 'loss' | 'push'
  bonusTriggered: boolean
  jackpotHit: boolean
}

/** A bonus-feature activation record. */
export interface BonusEvent {
  ts: number
  gameId: string
  roundId: string
  /** Spin number within the session when the bonus triggered */
  spinNumber: number
  /** Total winnings during the bonus round (filled on bonus_end) */
  totalBonusWin?: number
  bonusEndTs?: number
  bonusSpinCount?: number
}

/** Any single win worth >10× the bet size — highlighted to the user. */
export interface BigWinEvent {
  ts: number
  gameId: string
  roundId: string
  bet: number
  win: number
  multiplier: number
  /** Spin number within the session */
  spinNumber: number
  /** How we classify the magnitude */
  tier: 'big_win' | 'mega_win' | 'epic_win' | 'legendary_win'
}

// ─────────────────────────────────────────────────────────────────────────────
// Offline transaction buffer
// ─────────────────────────────────────────────────────────────────────────────

/** A transaction queued locally, waiting to be flushed to the API. */
export interface BufferedTransaction {
  /** Locally assigned id (used for dedup on retry) */
  localId: string
  sessionId: string
  gameId: string
  roundId: string
  betAmount: number
  winAmount: number
  result: 'win' | 'loss' | 'bonus'
  bonusTriggered: boolean
  jackpotHit: boolean
  /** When the spin actually happened */
  timestamp: number
  /** How many times we have tried (and failed) to send this */
  retryCount: number
  /** Epoch ms of the next allowed retry attempt */
  nextRetryAt: number
  /** True once the API confirmed receipt */
  synced: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Multi-game tracking
// ─────────────────────────────────────────────────────────────────────────────

/** Logged every time the player switches to a different game within a session. */
export interface GameSwitch {
  ts: number
  fromGameId: string | null
  toGameId: string
  spinCountAtSwitch: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Win / loss streak summary
// ─────────────────────────────────────────────────────────────────────────────

export interface StreakSummary {
  /** Current unbroken streak length (positive = wins, negative = losses) */
  current: number
  /** Longest win streak this session */
  longestWin: number
  /** Longest loss streak this session */
  longestLoss: number
  /** Direction of the current streak */
  direction: 'win' | 'loss' | 'none'
}

// ─────────────────────────────────────────────────────────────────────────────
// Session annotations
// ─────────────────────────────────────────────────────────────────────────────

export interface SessionAnnotation {
  ts: number
  source: 'user' | 'system' | 'ai'
  text: string
  /** Spin number the annotation relates to, if any */
  spinNumber?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Rich SessionStorageData
// ─────────────────────────────────────────────────────────────────────────────

export interface SessionStorageData {
  // ── Identity ──────────────────────────────────────────────────────────────
  sessionId: string
  platformSlug: string
  /** Millisecond epoch when the session was first created */
  startedAt: number
  /** Which browser tab is hosting the session (null = unknown) */
  tabId: number | null

  // ── Current game ──────────────────────────────────────────────────────────
  gameId: string | null
  /** Every time the player switches games we log it */
  gameSwitches: GameSwitch[]

  // ── Balance ───────────────────────────────────────────────────────────────
  coinsStart: { sc: number; gc: number }
  coinsCurrent: { sc: number; gc: number }
  /** Chronological balance snapshots — capped at 200 entries */
  balanceHistory: BalanceSnapshot[]

  // ── Spin event log ────────────────────────────────────────────────────────
  /** Last 200 spin events; older ones are evicted as new ones arrive */
  spinTimeline: SpinEvent[]
  transactionCount: number

  // ── Bonus & big-win tracking ──────────────────────────────────────────────
  /** All bonus activations in this session */
  bonusEvents: BonusEvent[]
  /** Wins with multiplier ≥ 10× */
  bigWins: BigWinEvent[]
  /** Whether a bonus round is currently active */
  inBonusRound: boolean
  /** Index into bonusEvents for the currently open bonus (null if none) */
  activeBonusIndex: number | null

  // ── Real-time analytics ───────────────────────────────────────────────────
  /** Running RTP samples (last 50 data points) for convergence visualisation */
  rtpSamples: number[]
  /** Current session RTP (0–200, i.e. 0 %–200 %) */
  rtpCurrent: number
  /** Session volatility index 0–100 derived from win-amount variance */
  volatilityIndex: number
  /** Win / loss streak state */
  streakSummary: StreakSummary
  /** Cumulative net result (totalWon – totalWagered) */
  netResult: number
  totalWagered: number
  totalWon: number
  /** The single largest win seen this session */
  largestWin: number
  /** Spin number on which the largest win occurred */
  largestWinSpinNumber: number

  // ── Session phase state machine ───────────────────────────────────────────
  phase: SessionPhase
  /** Unix ms when the current phase was entered */
  phaseChangedAt: number

  // ── Time accounting ───────────────────────────────────────────────────────
  lastActivityAt: number
  /** When idle detection kicked in (null = not idle) */
  idleStartedAt: number | null
  /** Accumulated idle time in ms (excluded from active duration) */
  totalIdleMs: number
  /** Pure active play time in ms */
  activeMs: number
  /** Unix ms of the most recent background heartbeat ack */
  lastHeartbeatAt: number

  // ── Offline transaction buffer ────────────────────────────────────────────
  /** Transactions waiting to be flushed to the API */
  transactionBuffer: BufferedTransaction[]
  /** Consecutive flush failures (used for exponential backoff) */
  syncFailureCount: number
  /** Unix ms of the last successful API sync */
  lastSyncedAt: number
  /** Total transactions synced to API (cumulative, across retries) */
  totalSyncedTransactions: number

  // ── Data quality ─────────────────────────────────────────────────────────
  /**
   * 0–100 score reflecting how complete / trustworthy the data is.
   * Factors: balance captured, round IDs present, no sync failures, etc.
   */
  sessionQualityScore: number

  // ── Annotations ───────────────────────────────────────────────────────────
  annotations: SessionAnnotation[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Session quality score calculator (pure function, no I/O)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate a 0–100 session quality score based on data richness.
 *
 * Scoring rubric:
 *   +20  Opening balance captured
 *   +15  At least 10 spins recorded
 *   +15  Balance history has ≥ 5 snapshots
 *   +15  Round IDs present on > 90 % of spins
 *   +10  No sync failures
 *   +10  Session has been active for > 5 minutes
 *   +10  Volatility index computed (≥ 30 spins required)
 *   +5   At least one annotation present
 */
export function calculateSessionQualityScore(s: SessionStorageData): number {
  let score = 0

  if (s.coinsStart.sc > 0 || s.coinsStart.gc > 0) score += 20

  const spinCount = s.spinTimeline.length
  if (spinCount >= 10) score += 15

  if (s.balanceHistory.length >= 5) score += 15

  if (spinCount > 0) {
    const withRoundId = s.spinTimeline.filter((e) => e.roundId && e.roundId !== '').length
    if (withRoundId / spinCount > 0.9) score += 15
  }

  if (s.syncFailureCount === 0) score += 10

  const ageMs = Date.now() - s.startedAt
  if (ageMs > 5 * 60_000) score += 10

  if (spinCount >= 30) score += 10

  if (s.annotations.length > 0) score += 5

  return Math.min(100, score)
}

// ─────────────────────────────────────────────────────────────────────────────
// Big-win tier classifier (pure function)
// ─────────────────────────────────────────────────────────────────────────────

export function classifyWinTier(multiplier: number): BigWinEvent['tier'] | null {
  if (multiplier >= 1000) return 'legendary_win'
  if (multiplier >= 100) return 'epic_win'
  if (multiplier >= 25) return 'mega_win'
  if (multiplier >= 10) return 'big_win'
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Remaining storage schema
// ─────────────────────────────────────────────────────────────────────────────

export interface PlatformCredential {
  platformSlug: string
  // TODO(security): encrypt with Web Crypto API before storing —
  // currently stored as plaintext in chrome.storage.local
  username: string
  password: string
  storedAt: number
}

export interface NotificationPreferences {
  enableSurgeAlerts: boolean
  enableJackpotAlerts: boolean
  enableDailyDigest: boolean
  enableBonusReminders: boolean
  enableStreakAlerts: boolean
  enableBigWinCelebrations: boolean
  enableSessionQualityWarnings: boolean
  muted: boolean
  /** Minimum win multiplier that triggers a big-win notification */
  bigWinThresholdMultiplier: number
}

export type AnalyticsEventType =
  | 'spin'
  | 'win'
  | 'big_win'
  | 'bonus_triggered'
  | 'bonus_ended'
  | 'jackpot_hit'
  | 'balance_update'
  | 'session_start'
  | 'session_end'
  | 'session_paused'
  | 'session_resumed'
  | 'game_switch'
  | 'idle_entered'
  | 'idle_exited'
  | 'sync_success'
  | 'sync_failure'
  | 'record_broken'
  | 'streak_milestone'

export interface AnalyticsEvent {
  type: AnalyticsEventType
  platformSlug: string
  timestamp: number
  data: Record<string, unknown>
}

// ─────────────────────────────────────────────────────────────────────────────
// Full storage schema
// ─────────────────────────────────────────────────────────────────────────────

export interface StorageSchema {
  userId: string | null
  authToken: string | null
  userRefCode: string | null
  sessionData: SessionStorageData | null
  personalRecords: import('./records-tracker').PersonalRecords | null
  sessionStreak: import('./streak-tracker').StreakData | null
  voiceConsentGranted: boolean
  voicePrivacyMode: boolean
  platformCredentials: Record<string, PlatformCredential>
  hudEnabled: boolean
  hudPosition: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  hudOpacity: number // 0.0 – 1.0
  notificationPrefs: NotificationPreferences
  analyticsEvents: AnalyticsEvent[]
  lastSyncedAt: number
  affiliateNoShowUntil: Record<string, number>
  /** How many sessions this user has completed (for onboarding hints) */
  completedSessionCount: number
  /** Platform slugs for which the user has dismissed the quick-start guide */
  dismissedOnboardingPlatforms: string[]
}

const DEFAULT_STORAGE: StorageSchema = {
  userId: null,
  authToken: null,
  userRefCode: null,
  sessionData: null,
  personalRecords: null,
  sessionStreak: null,
  voiceConsentGranted: false,
  voicePrivacyMode: false,
  platformCredentials: {},
  hudEnabled: true,
  hudPosition: 'bottom-right',
  hudOpacity: 0.92,
  notificationPrefs: {
    enableSurgeAlerts: true,
    enableJackpotAlerts: true,
    enableDailyDigest: true,
    enableBonusReminders: true,
    enableStreakAlerts: true,
    enableBigWinCelebrations: true,
    enableSessionQualityWarnings: true,
    muted: false,
    bigWinThresholdMultiplier: 10,
  },
  analyticsEvents: [],
  lastSyncedAt: 0,
  affiliateNoShowUntil: {},
  completedSessionCount: 0,
  dismissedOnboardingPlatforms: [],
}

// ─────────────────────────────────────────────────────────────────────────────
// StorageManager
// ─────────────────────────────────────────────────────────────────────────────

export class StorageManager {
  private cache: Partial<StorageSchema> = {}
  private cacheReady = false

  /** Initialize cache from Chrome storage */
  async init(): Promise<void> {
    if (this.cacheReady) return
    try {
      const items = await chrome.storage.local.get()
      this.cache = items as Partial<StorageSchema>
      this.cacheReady = true
    } catch (error) {
      log.error('Failed to initialize', { error })
      this.cache = {}
      this.cacheReady = true
    }
  }

  /** Get a single value with type safety */
  async get<K extends keyof StorageSchema>(key: K): Promise<StorageSchema[K]> {
    await this.init()
    if (key in this.cache) {
      return this.cache[key] as StorageSchema[K]
    }
    return DEFAULT_STORAGE[key]
  }

  /** Set a single value */
  async set<K extends keyof StorageSchema>(key: K, value: StorageSchema[K]): Promise<void> {
    await this.init()
    this.cache[key] = value
    try {
      await chrome.storage.local.set({ [key]: value })
    } catch (error) {
      log.error('Failed to set key', { key: String(key), error })
    }
  }

  /** Get multiple values atomically */
  async getMultiple<K extends keyof StorageSchema>(keys: K[]): Promise<Pick<StorageSchema, K>> {
    await this.init()
    const result = {} as Pick<StorageSchema, K>
    for (const key of keys) {
      result[key] = (this.cache[key] ?? DEFAULT_STORAGE[key]) as StorageSchema[K]
    }
    return result
  }

  // ── Atomic session helpers ──────────────────────────────────────────────

  /**
   * Read the current session, apply a mutation, and write it back atomically.
   * Returns null if there is no active session.
   */
  async mutateSession(
    mutator: (session: SessionStorageData) => SessionStorageData
  ): Promise<SessionStorageData | null> {
    await this.init()
    const session = await this.get('sessionData')
    if (!session) return null
    const updated = mutator({ ...session })
    await this.set('sessionData', updated)
    return updated
  }

  /**
   * Append a spin event to the session timeline, evicting old entries when
   * the buffer is full.  Also updates running analytics fields (RTP, net
   * result, volatility, streak, big wins) in place.
   */
  async recordSpin(spin: SpinEvent): Promise<SessionStorageData | null> {
    return this.mutateSession((s) => {
      const MAX_SPINS = 200

      // Append spin
      s.spinTimeline = [...s.spinTimeline, spin].slice(-MAX_SPINS)
      s.transactionCount += 1

      // Running totals
      s.totalWagered = +(s.totalWagered + spin.bet).toFixed(2)
      s.totalWon = +(s.totalWon + spin.win).toFixed(2)
      s.netResult = +(s.totalWon - s.totalWagered).toFixed(2)

      // Largest win
      if (spin.win > s.largestWin) {
        s.largestWin = spin.win
        s.largestWinSpinNumber = s.transactionCount
      }

      // Real-time RTP
      s.rtpCurrent = s.totalWagered > 0 ? +((s.totalWon / s.totalWagered) * 100).toFixed(2) : 0
      const MAX_RTP_SAMPLES = 50
      s.rtpSamples = [...s.rtpSamples, s.rtpCurrent].slice(-MAX_RTP_SAMPLES)

      // Volatility index — standard deviation of win amounts normalised to bet
      if (s.spinTimeline.length >= 10) {
        const mults = s.spinTimeline.map((e) => e.multiplier)
        const mean = mults.reduce((a, b) => a + b, 0) / mults.length
        const variance = mults.reduce((a, b) => a + (b - mean) ** 2, 0) / mults.length
        const stdDev = Math.sqrt(variance)
        // Scale to 0–100 (stdDev of 10 ≈ 100)
        s.volatilityIndex = Math.min(100, Math.round((stdDev / 10) * 100))
      }

      // Win/loss streak
      if (spin.result === 'win') {
        if (s.streakSummary.direction === 'win') {
          s.streakSummary.current += 1
        } else {
          s.streakSummary.current = 1
          s.streakSummary.direction = 'win'
        }
        s.streakSummary.longestWin = Math.max(s.streakSummary.longestWin, s.streakSummary.current)
      } else if (spin.result === 'loss') {
        if (s.streakSummary.direction === 'loss') {
          s.streakSummary.current -= 1
        } else {
          s.streakSummary.current = -1
          s.streakSummary.direction = 'loss'
        }
        s.streakSummary.longestLoss = Math.max(
          s.streakSummary.longestLoss,
          Math.abs(s.streakSummary.current)
        )
      }

      // Big win detection
      const tier = classifyWinTier(spin.multiplier)
      if (tier) {
        const MAX_BIG_WINS = 50
        s.bigWins = [
          ...s.bigWins,
          {
            ts: spin.ts,
            gameId: spin.gameId,
            roundId: spin.roundId,
            bet: spin.bet,
            win: spin.win,
            multiplier: spin.multiplier,
            spinNumber: s.transactionCount,
            tier,
          },
        ].slice(-MAX_BIG_WINS)
      }

      // Bonus event tracking
      if (spin.bonusTriggered) {
        s.bonusEvents.push({
          ts: spin.ts,
          gameId: spin.gameId,
          roundId: spin.roundId,
          spinNumber: s.transactionCount,
        })
        s.inBonusRound = true
        s.activeBonusIndex = s.bonusEvents.length - 1
        s.phase = 'bonus_round'
        s.phaseChangedAt = spin.ts
      }

      // Phase progression
      if (s.phase === 'warmup' && s.transactionCount >= 20) {
        s.phase = 'active'
        s.phaseChangedAt = spin.ts
      }

      // Time accounting
      s.lastActivityAt = spin.ts
      s.activeMs = spin.ts - s.startedAt - s.totalIdleMs

      // Session quality
      s.sessionQualityScore = calculateSessionQualityScore(s)

      return s
    })
  }

  /**
   * Append a balance snapshot.  Evicts oldest if buffer exceeds 200 entries.
   */
  async recordBalance(snapshot: BalanceSnapshot): Promise<SessionStorageData | null> {
    return this.mutateSession((s) => {
      const MAX_SNAPSHOTS = 200
      s.balanceHistory = [...s.balanceHistory, snapshot].slice(-MAX_SNAPSHOTS)
      s.coinsCurrent = { sc: snapshot.sc, gc: snapshot.gc }
      s.lastActivityAt = snapshot.ts
      s.sessionQualityScore = calculateSessionQualityScore(s)
      return s
    })
  }

  /**
   * Append a buffered transaction to the pending sync queue.
   */
  async enqueueTransaction(tx: BufferedTransaction): Promise<void> {
    await this.mutateSession((s) => {
      // Dedup by localId
      const exists = s.transactionBuffer.some((b) => b.localId === tx.localId)
      if (!exists) {
        s.transactionBuffer = [...s.transactionBuffer, tx]
      }
      return s
    })
  }

  /**
   * Mark a batch of transactions as synced, removing them from the buffer.
   */
  async markTransactionsSynced(localIds: string[]): Promise<void> {
    const idSet = new Set(localIds)
    await this.mutateSession((s) => {
      s.transactionBuffer = s.transactionBuffer.filter((tx) => !idSet.has(tx.localId))
      s.totalSyncedTransactions += localIds.length
      s.syncFailureCount = 0
      s.lastSyncedAt = Date.now()
      s.sessionQualityScore = calculateSessionQualityScore(s)
      return s
    })
  }

  /**
   * Increment retry counts for a batch that failed to sync.
   * Applies exponential back-off: nextRetryAt = now + 2^retryCount * 5 s
   */
  async markTransactionSyncFailed(localIds: string[]): Promise<void> {
    const idSet = new Set(localIds)
    await this.mutateSession((s) => {
      const now = Date.now()
      s.transactionBuffer = s.transactionBuffer.map((tx) => {
        if (!idSet.has(tx.localId)) return tx
        const retryCount = tx.retryCount + 1
        const backoffMs = Math.min(Math.pow(2, retryCount) * 5_000, 5 * 60_000) // cap 5 min
        return { ...tx, retryCount, nextRetryAt: now + backoffMs }
      })
      s.syncFailureCount += 1
      s.sessionQualityScore = calculateSessionQualityScore(s)
      return s
    })
  }

  // ── Analytics event logger ──────────────────────────────────────────────

  /**
   * Append to analyticsEvents array (auto-trims to most recent 500 events).
   */
  async logEvent(event: AnalyticsEvent): Promise<void> {
    await this.init()
    const events = ((this.cache.analyticsEvents ?? []) as AnalyticsEvent[]).concat(event)
    const trimmed = events.length > 500 ? events.slice(events.length - 500) : events
    await this.set('analyticsEvents', trimmed)
  }

  // ── Utility ─────────────────────────────────────────────────────────────

  /** Clear all storage */
  async clear(): Promise<void> {
    this.cache = {}
    this.cacheReady = false
    try {
      await chrome.storage.local.clear()
    } catch (error) {
      log.error('Failed to clear storage', { error })
    }
  }

  /**
   * Watch for storage changes from other contexts (cross-tab sync).
   */
  onChanged(callback: (changes: Record<string, chrome.storage.StorageChange>) => void): void {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local') {
        for (const [key, change] of Object.entries(changes)) {
          if ('newValue' in change) {
            ;(this.cache as Record<string, unknown>)[key] = change.newValue
          } else {
            delete (this.cache as Record<string, unknown>)[key]
          }
        }
        callback(changes)
      }
    })
  }
}

export const storage = new StorageManager()

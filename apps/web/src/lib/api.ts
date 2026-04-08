import type { ApiResponse } from '@sweepbot/types'
import { supabaseClient, supabaseStub } from './supabase'
import { logger } from '@sweepbot/utils'

const API_BASE = import.meta.env.VITE_API_URL ?? '/api/v1'

// Use supabaseClient which handles the null case
const getSupabase = () => supabaseClient ?? supabaseStub

// ── Error types ───────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status?: number,
    public data?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export class NetworkError extends ApiError {
  constructor(message = 'Network request failed. Check your connection.') {
    super('NETWORK_ERROR', message, 0)
    this.name = 'NetworkError'
  }
}

export class TimeoutError extends ApiError {
  constructor(timeoutMs: number) {
    super('TIMEOUT_ERROR', `Request timed out after ${timeoutMs}ms`, 408)
    this.name = 'TimeoutError'
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Session expired. Please log in again.') {
    super('UNAUTHORIZED', message, 401)
    this.name = 'UnauthorizedError'
  }
}

// ── Auth headers ──────────────────────────────────────────────────────────────

async function getAuthHeaders(): Promise<Record<string, string>> {
  const supabase = getSupabase()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.access_token) {
    return { 'Content-Type': 'application/json' }
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  }
}

// ── Retry helpers ─────────────────────────────────────────────────────────────

function calcRetryDelay(attempt: number, base = 1000): number {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  const jitter = ((buf[0] ?? 0) / 2 ** 32) * 500
  return Math.min(base * 2 ** attempt, 10_000) + jitter
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ── In-flight dedup map ───────────────────────────────────────────────────────

const pendingRequests = new Map<string, Promise<unknown>>()

// ── Core request (with timeout + retry + deduplication) ───────────────────────

interface RequestConfig extends RequestInit {
  /** AbortController timeout in ms (default 30 s) */
  timeout?: number
  /** Max additional retry attempts for network/5xx errors (default 2) */
  retries?: number
  /** Base delay for exponential backoff in ms (default 1000) */
  retryDelay?: number
}

async function request<T>(path: string, config: RequestConfig = {}): Promise<T> {
  const { timeout = 30_000, retries = 2, retryDelay = 1000, ...options } = config
  const method = (options.method ?? 'GET').toUpperCase()
  const isGet = method === 'GET'
  const cacheKey = `${method}:${path}:${options.body ?? ''}`

  // Deduplicate concurrent identical GET requests
  if (isGet) {
    const pending = pendingRequests.get(cacheKey)
    if (pending) return pending as Promise<T>
  }

  const execute = async (_attempt: number): Promise<T> => {
    const headers = await getAuthHeaders()
    const controller = new AbortController()
    const timerId = setTimeout(() => controller.abort(), timeout)

    let response: Response
    try {
      response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: { ...headers, ...(options.headers as Record<string, string>) },
        signal: controller.signal,
      })
    } catch (err) {
      clearTimeout(timerId)
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new TimeoutError(timeout)
      }
      if (err instanceof TypeError) throw new NetworkError()
      throw err
    } finally {
      clearTimeout(timerId)
    }

    if (response.status === 401) {
      throw new UnauthorizedError()
    }

    const json = (await response.json()) as ApiResponse<T>

    if (!json.success) {
      const e = new ApiError(json.error.code, json.error.message, response.status)
      logger.error('API error', { path, code: json.error.code, status: response.status })
      throw e
    }

    return json.data
  }

  const withRetry = async (): Promise<T> => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await execute(attempt)
      } catch (err) {
        const isRetryable =
          attempt < retries &&
          !(err instanceof UnauthorizedError) &&
          !(
            err instanceof ApiError &&
            err.status !== undefined &&
            err.status >= 400 &&
            err.status < 500
          )

        if (!isRetryable) throw err

        const delay = calcRetryDelay(attempt, retryDelay)
        logger.warn('API request failed, retrying', {
          path,
          attempt: attempt + 1,
          delayMs: delay,
          error: err instanceof Error ? err.message : String(err),
        })
        await sleep(delay)
      }
    }
    // unreachable but satisfies TS
    throw new ApiError('UNKNOWN_ERROR', 'Request failed after retries')
  }

  const promise = withRetry() as Promise<T>

  if (isGet) {
    pendingRequests.set(cacheKey, promise)
    promise.finally(() => pendingRequests.delete(cacheKey))
  }

  return promise
}

// ─── Query string helper ──────────────────────────────────────────────────────
function toQS(params?: Record<string, string | number | boolean | undefined>): string {
  if (!params) return ''
  const filtered = Object.fromEntries(
    Object.entries(params)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)])
  )
  const qs = new URLSearchParams(filtered).toString()
  return qs ? `?${qs}` : ''
}

// ─── Shared public types ──────────────────────────────────────────────────────

export interface NotificationItem {
  id: string
  type: string
  title: string
  body: string
  is_read: boolean
  read_at: string | null
  icon: string | null
  href: string | null
  data: unknown
  created_at: string
}

export interface StreakLeaderboardEntry {
  user_id: string
  display_name: string | null
  current_streak: number
  longest_streak: number
}

export interface TrialStatus {
  isActive: boolean
  daysRemaining: number
  trialEndsAt: string | null
  tier: string
  converted: boolean
}

export interface RecordActivityResult {
  currentStreak: number
  milestoneReached?: number
}

// ─── Typed API client ─────────────────────────────────────────────────────────
export const api = {
  // Health
  health: {
    check: () => request<{ status: string; services: { database: string } }>('/health'),
  },

  // User
  user: {
    profile: () => request<Record<string, unknown>>('/user/profile'),
    updateProfile: (data: Record<string, unknown>) =>
      request('/user/profile', { method: 'PATCH', body: JSON.stringify(data) }),
    settings: () => request<Record<string, unknown>>('/user/settings'),
    updateSettings: (data: Record<string, unknown>) =>
      request('/user/settings', { method: 'PUT', body: JSON.stringify(data) }),
    platforms: () => request<Record<string, unknown>[]>('/user/platforms'),
    addPlatform: (data: Record<string, unknown>) =>
      request('/user/platforms', { method: 'POST', body: JSON.stringify(data) }),
    removePlatform: (id: string) => request(`/user/platforms/${id}`, { method: 'DELETE' }),

    // Subscription & billing
    subscription: () => request<Record<string, unknown>>('/user/subscription'),
    createCheckoutSession: (tier: string, cycle: string) =>
      request<{ url: string }>('/user/checkout', {
        method: 'POST',
        body: JSON.stringify({ tier, cycle }),
      }),

    // Notification preferences
    notificationPrefs: () => request<Record<string, boolean>>('/user/notification-prefs'),
    updateNotificationPrefs: (data: Record<string, boolean>) =>
      request<Record<string, boolean>>('/user/notification-prefs', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    // Tax summary
    taxSummary: (year: number) =>
      request<Record<string, unknown>>(`/user/tax-summary?year=${year}`),

    // Self-exclusion
    selfExclude: (days: number = 30) =>
      request<Record<string, unknown>>('/user/self-exclude', {
        method: 'POST',
        body: JSON.stringify({ days }),
      }),

    // Account deletion
    deleteAccount: () => request<{ deleted: boolean }>('/user/account', { method: 'DELETE' }),
  },

  // Platforms
  platforms: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : ''
      return request<Record<string, unknown>[]>(`/platforms${qs}`)
    },
    get: (id: string) => request<Record<string, unknown>>(`/platforms/${id}`),
    games: (id: string, params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : ''
      return request<Record<string, unknown>[]>(`/platforms/${id}/games${qs}`)
    },
    tosHistory: (id: string) => request<Record<string, unknown>[]>(`/platforms/${id}/tos-history`),
  },

  // Sessions
  sessions: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : ''
      return request<Record<string, unknown>[]>(`/sessions${qs}`)
    },
    get: (id: string) => request<Record<string, unknown>>(`/sessions/${id}`),
    create: (data: Record<string, unknown>) =>
      request('/sessions', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Record<string, unknown>) =>
      request(`/sessions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    end: (
      id: string,
      data: {
        ended_at: string
        sc_balance_close?: number
        gc_balance_close?: number
        notes?: string
      }
    ) => request(`/sessions/${id}/end`, { method: 'PATCH', body: JSON.stringify(data) }),
    batchTransactions: (data: Record<string, unknown>) =>
      request('/sessions/transactions/batch', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  // Analytics
  analytics: {
    portfolio: () => request<Record<string, unknown>>('/analytics/portfolio'),
    rtp: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : ''
      return request<Record<string, unknown>>(`/analytics/rtp${qs}`)
    },
    temporal: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : ''
      return request<Record<string, unknown>>(`/analytics/temporal${qs}`)
    },
    bonus: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : ''
      return request<Record<string, unknown>>(`/analytics/bonus${qs}`)
    },
    streaks: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : ''
      return request<Record<string, unknown>>(`/analytics/streaks${qs}`)
    },
    insights: () => request<Record<string, unknown>>('/analytics/insights'),
    export: (params: { start_date: string; end_date: string }) =>
      `/analytics/export?start_date=${params.start_date}&end_date=${params.end_date}`,
  },

  // Jackpots
  jackpots: {
    leaderboard: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : ''
      return request<Record<string, unknown>[]>(`/jackpots${qs}`)
    },
    history: (gameId: string) => request<Record<string, unknown>[]>(`/jackpots/${gameId}/history`),
    stats: () => request<Record<string, unknown>>('/jackpots/stats'),
  },

  // Redemptions
  redemptions: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : ''
      return request<Record<string, unknown>[]>(`/redemptions${qs}`)
    },
    create: (data: Record<string, unknown>) =>
      request('/redemptions', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Record<string, unknown>) =>
      request(`/redemptions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    stats: () => request<Record<string, unknown>>('/redemptions/stats'),
    communityBenchmarks: () =>
      request<Record<string, unknown>[]>('/redemptions/community-benchmarks'),
  },

  // Trust Index
  trust: {
    /** Ranked list of all platforms with current Trust Index scores */
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : ''
      return request<Record<string, unknown>[]>(`/trust-index${qs}`)
    },
    /** Full detail for a single platform (score + component breakdown + history) */
    get: (platformId: string) => request<Record<string, unknown>>(`/trust-index/${platformId}`),
    /** Top-ranked platforms + score distribution charts */
    leaderboard: () => request<Record<string, unknown>>('/trust-index/leaderboard'),
    /** User's percentile rank relative to all SweepBot users for a platform */
    percentile: (platformId: string) =>
      request<Record<string, unknown>>(`/trust-index/${platformId}/percentile`),
    /** List the current user's alert subscriptions */
    alerts: () => request<Record<string, unknown>[]>('/trust-index/alerts'),
    /** Subscribe to score change alerts for a platform */
    addAlert: (data: {
      platform_id: string
      threshold_direction?: string
      threshold_score?: number
    }) =>
      request<Record<string, unknown>>('/trust-index/alerts', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    /** Unsubscribe from alerts for a platform */
    removeAlert: (platformId: string) =>
      request<Record<string, unknown>>(`/trust-index/alerts/${platformId}`, {
        method: 'DELETE',
      }),
  },

  // TOS Monitor
  tos: {
    /** All changes across every monitored platform, most-recent-first */
    changes: (params?: {
      severity?: string
      platform_id?: string
      limit?: number
      page?: number
    }) => request<Record<string, unknown>[]>(`/tos/changes${toQS(params)}`),
    /** Aggregate stats: monitored count, changes this week, major alerts */
    stats: () => request<Record<string, unknown>>('/tos/stats'),
    /** Full diff text for a specific change */
    diff: (changeId: string) => request<Record<string, unknown>>(`/tos/changes/${changeId}/diff`),
    /** Toggle watched status for a platform */
    watch: (platformId: string, watching: boolean) =>
      request<Record<string, unknown>>(`/tos/watch/${platformId}`, {
        method: 'PUT',
        body: JSON.stringify({ watching }),
      }),
    /** Platforms the user is watching */
    watchlist: () => request<Record<string, unknown>[]>('/tos/watchlist'),
    /** Historical snapshot list for a specific platform */
    platformHistory: (platformId: string) =>
      request<Record<string, unknown>[]>(`/tos/platforms/${platformId}/history`),
  },

  // Tax Center
  tax: {
    /** Full tax-year summary: redemptions, estimated liability, monthly breakdown */
    summary: (year: number) => request<Record<string, unknown>>(`/tax/summary?year=${year}`),
    /** Redemption line-items for tax purposes (paginated) */
    transactions: (params?: { year?: number; page?: number; limit?: number }) =>
      request<Record<string, unknown>[]>(`/tax/transactions${toQS(params)}`),
    /** CSV export URL (returns download URL, not the raw CSV) */
    exportUrl: (year: number) => `${API_BASE}/tax/export?year=${year}`,
    /** Month-by-month chart data */
    monthly: (year: number) => request<Record<string, unknown>[]>(`/tax/monthly?year=${year}`),
    /** Multi-year P&amp;L overview */
    yearOverYear: () => request<Record<string, unknown>[]>('/tax/year-over-year'),
  },

  // Phase 2 Features
  features: {
    achievements: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : ''
      return request<Record<string, unknown>[]>(`/features/achievements${qs}`)
    },
    myAchievements: () => request<Record<string, unknown>[]>('/features/achievements/mine'),
    achievementLeaderboard: () =>
      request<Record<string, unknown>[]>('/features/achievements/leaderboard'),
    checkAchievements: () =>
      request<Record<string, unknown>>('/features/achievements/check', { method: 'POST' }),
    heatmap: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : ''
      return request<Record<string, unknown>[]>(`/features/heatmap${qs}`)
    },
    streaks: () => request<Record<string, unknown>>('/features/streaks'),
    records: () => request<Record<string, unknown>>('/features/records'),
    refreshRecords: () =>
      request<Record<string, unknown>>('/features/records/refresh', { method: 'POST' }),
    bigWins: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : ''
      return request<Record<string, unknown>[]>(`/features/big-wins${qs}`)
    },
    submitBigWin: (data: Record<string, unknown>) =>
      request<Record<string, unknown>>('/features/big-wins', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    myBigWins: () => request<Record<string, unknown>[]>('/features/big-wins/mine'),
    updateBigWin: (id: string, data: Record<string, unknown>) =>
      request<Record<string, unknown>>(`/features/big-wins/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    stats: () => request<Record<string, unknown>>('/features/stats'),
  },

  // Flows
  flows: {
    list: (params?: { page?: number; pageSize?: number }) =>
      request<Record<string, unknown>[]>(`/flows${toQS(params)}`),
    get: (id: string) => request<Record<string, unknown>>(`/flows/${id}`),
    create: (data: Record<string, unknown>) =>
      request<Record<string, unknown>>('/flows', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Record<string, unknown>) =>
      request<Record<string, unknown>>(`/flows/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    interpret: (rawInput: string) =>
      request<Record<string, unknown>>('/flows/interpret', {
        method: 'POST',
        body: JSON.stringify({ rawInput }),
      }),
    startConversation: (initialMessage: string) =>
      request<Record<string, unknown>>('/flows/conversations', {
        method: 'POST',
        body: JSON.stringify({ initialMessage }),
      }),
    converse: (conversationId: string, userMessage: string) =>
      request<Record<string, unknown>>('/flows/converse', {
        method: 'POST',
        body: JSON.stringify({ conversationId, userMessage }),
      }),
    execute: (id: string) =>
      request<Record<string, unknown>>(`/flows/${id}/execute`, { method: 'POST' }),
    getCurrentExecution: (id: string) =>
      request<Record<string, unknown> | null>(`/flows/${id}/execution/current`),
    cancelExecution: (id: string) =>
      request<Record<string, unknown>>(`/flows/${id}/execution/cancel`, { method: 'POST' }),
    executions: (id: string, params?: { page?: number; pageSize?: number }) =>
      request<Record<string, unknown>[]>(`/flows/${id}/executions${toQS(params)}`),
    delete: (id: string) => request<{ deleted: boolean }>(`/flows/${id}`, { method: 'DELETE' }),
  },

  // Achievements API
  achievements: {
    streaks: () => request<Record<string, unknown>>('/achievements/streaks'),
    records: () => request<Record<string, unknown>>('/achievements/records'),
    summary: () => request<Record<string, unknown>>('/achievements/summary'),
    recordSession: (data: Record<string, unknown>) =>
      request<Record<string, unknown>>('/achievements/streaks/record', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  // Notifications
  notifications: {
    list: (params?: { limit?: number; unread_only?: boolean }) =>
      request<NotificationItem[]>(`/notifications${toQS(params)}`),
    count: () => request<{ unread: number }>('/notifications/count'),
    markRead: (id: string) =>
      request<{ id: string }>(`/notifications/${id}/read`, { method: 'PATCH' }),
    markAllRead: () => request<{ marked: boolean }>('/notifications/read-all', { method: 'POST' }),
    delete: (id: string) =>
      request<{ deleted: boolean }>(`/notifications/${id}`, { method: 'DELETE' }),
    preferences: () => request<Record<string, boolean>>('/notifications/preferences'),
    updatePreferences: (data: Record<string, boolean>) =>
      request<{ updated: boolean }>('/notifications/preferences', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    subscribePush: (subscription: Record<string, unknown>) =>
      request<{ subscribed: boolean }>('/notifications/subscribe', {
        method: 'POST',
        body: JSON.stringify(subscription),
      }),
  },

  // Subscriptions
  subscriptions: {
    /** Returns the current user's trial status and subscription tier. */
    trialStatus: () => request<TrialStatus>('/user/subscription'),
    /** Activates a 14-day Pro trial for the current user. */
    startTrial: () => request<Record<string, unknown>>('/user/start-trial', { method: 'POST' }),
  },

  // Session Notes
  sessionNotes: {
    /** List all notes for a session. */
    list: (sessionId: string) =>
      request<Record<string, unknown>[]>(`/session-notes/by-session/${sessionId}`),
    /** Create a new note for a session. */
    create: (
      sessionId: string,
      data: { content: string; noteType: string; audioUrl?: string; audioDuration?: number }
    ) =>
      request<Record<string, unknown>>('/session-notes', {
        method: 'POST',
        body: JSON.stringify({ sessionId, ...data }),
      }),
    /** Delete a session note by id. */
    delete: (id: string) =>
      request<{ deleted: boolean }>(`/session-notes/${id}`, { method: 'DELETE' }),
  },

  // Streaks
  streaks: {
    /** Get the current user's streak data. */
    get: () => request<Record<string, unknown>>('/streaks'),
    /** Record activity for today (increments streak). */
    recordActivity: () => request<RecordActivityResult>('/streaks/record', { method: 'POST' }),
    /** Opt-in leaderboard — top N users by current streak. */
    leaderboard: (limit = 50) =>
      request<StreakLeaderboardEntry[]>(`/streaks/leaderboard${toQS({ limit })}`),
  },
}

/**
 * ExtensionAPI — typed, retry-safe HTTP client for the Sweepbot API.
 *
 * Features
 * ────────
 *  • Reads API base URL from environment at call time (supports hot config)
 *  • Auth token automatically attached from chrome.storage
 *  • 401 Unauthorized triggers a single token-refresh attempt before giving up
 *  • Configurable per-request timeout (default: 10 s)
 *  • Network errors are classified: retryable vs permanent
 *  • All public methods return typed results via response wrapper
 *  • Batch transaction endpoint accepts rich round-level metadata
 */

import { storage } from './storage'
import { createLogger } from './logger'

const log = createLogger('ExtensionAPI')

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 10_000
const MAX_RETRIES = 2
const RETRY_DELAY_MS = 1_000

function apiBase(): string {
  // Prefer env injection; fall back to localhost for development
  return (
    (typeof import.meta !== 'undefined' && (import.meta as unknown as Record<string, unknown>).env
      ? ((import.meta as unknown as Record<string, Record<string, string>>).env
          .VITE_API_BASE_URL as string)
      : null) ?? 'http://localhost:3001/api/v1'
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Error types
// ─────────────────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly retryable: boolean,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export class NetworkError extends Error {
  constructor(
    message: string,
    public readonly retryable = true,
  ) {
    super(message)
    this.name = 'NetworkError'
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Request types
// ─────────────────────────────────────────────────────────────────────────────

export interface SessionResponse {
  sessionId: string
  message: string
}

export interface SessionEndResponse {
  rtp: number
  netResult: number
}

export interface TransactionRequest {
  game_id: string
  bet_amount: number
  win_amount: number
  result: 'win' | 'loss' | 'bonus'
  /** Optional round identifier for dedup on the server side */
  round_id?: string
  bonus_triggered?: boolean
  jackpot_hit?: boolean
  timestamp?: string
}

export interface UserProfileResponse {
  id: string
  email: string
  displayName: string | null
  tier: string
  streakDays: number
  completedSessions: number
}

export interface SessionSummaryResponse {
  sessionId: string
  platformSlug: string
  rtp: number
  netResult: number
  spinCount: number
  startedAt: string
  endedAt: string | null
  durationSeconds: number | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Core fetch helper
// ─────────────────────────────────────────────────────────────────────────────

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export class ExtensionAPI {
  private _refreshInFlight = false

  // ── Auth ────────────────────────────────────────────────────────────────

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await storage.get('authToken')
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
  }

  // ── Core request with retry ─────────────────────────────────────────────

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    opts: { timeoutMs?: number; retries?: number } = {},
  ): Promise<T> {
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
    const maxRetries = opts.retries ?? MAX_RETRIES
    const url = `${apiBase()}${path}`

    let lastError: Error | null = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        await sleep(RETRY_DELAY_MS * attempt)
      }

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), timeoutMs)

      try {
        const headers = await this.getAuthHeaders()
        const response = await fetch(url, {
          method,
          headers,
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        })

        clearTimeout(timeout)

        // 401 — attempt token refresh once
        if (response.status === 401 && !this._refreshInFlight) {
          const refreshed = await this._tryRefreshToken()
          if (refreshed && attempt < maxRetries) continue
          throw new ApiError('Unauthorized', 401, 'UNAUTHORIZED', false)
        }

        if (!response.ok) {
          let code = 'API_ERROR'
          let message = response.statusText
          try {
            const err = (await response.json()) as { error?: { code?: string; message?: string } }
            code = err.error?.code ?? code
            message = err.error?.message ?? message
          } catch { /* ignore */ }

          const retryable = response.status >= 500 && response.status < 600
          throw new ApiError(message, response.status, code, retryable)
        }

        const data = (await response.json()) as { data: T }
        return data.data
      } catch (err) {
        clearTimeout(timeout)

        if (err instanceof ApiError) {
          if (!err.retryable) throw err
          lastError = err
          continue
        }

        if (err instanceof Error && err.name === 'AbortError') {
          lastError = new NetworkError('Request timed out', true)
          continue
        }

        if (err instanceof TypeError) {
          // Network failure
          lastError = new NetworkError(err.message, true)
          continue
        }

        throw err
      }
    }

    throw lastError ?? new NetworkError('Request failed after retries', true)
  }

  private async _tryRefreshToken(): Promise<boolean> {
    if (this._refreshInFlight) return false
    this._refreshInFlight = true
    try {
      // Placeholder: the web app handles full auth via Supabase;
      // the extension only holds the JWT from chrome.storage.
      // A real refresh would POST to /auth/refresh with the stored refresh_token.
      log.warn('Token refresh not yet implemented')
      return false
    } finally {
      this._refreshInFlight = false
    }
  }

  // ── Session endpoints ────────────────────────────────────────────────────

  async createSession(platformSlug: string, gameId: string): Promise<SessionResponse> {
    return this.request<SessionResponse>('POST', '/sessions', {
      platform_slug: platformSlug,
      game_id: gameId || undefined,
      started_at: new Date().toISOString(),
    })
  }

  async endSession(sessionId: string): Promise<SessionEndResponse> {
    return this.request<SessionEndResponse>('PATCH', `/sessions/${sessionId}/end`, {
      ended_at: new Date().toISOString(),
    })
  }

  async updateSessionBalance(
    sessionId: string,
    scBalance: number,
    gcBalance: number,
  ): Promise<void> {
    await this.request<void>('PATCH', `/sessions/${sessionId}/balance`, {
      sc_balance: scBalance,
      gc_balance: gcBalance,
    })
  }

  async getSession(sessionId: string): Promise<SessionSummaryResponse> {
    return this.request<SessionSummaryResponse>('GET', `/sessions/${sessionId}`)
  }

  // ── Transaction endpoints ────────────────────────────────────────────────

  async recordTransaction(sessionId: string, transaction: TransactionRequest): Promise<void> {
    await this.request<void>('POST', `/sessions/${sessionId}/transactions`, {
      ...transaction,
      timestamp: transaction.timestamp ?? new Date().toISOString(),
    })
  }

  async batchTransactions(
    sessionId: string,
    transactions: TransactionRequest[],
  ): Promise<void> {
    if (transactions.length === 0) return
    await this.request<void>('POST', '/sessions/transactions/batch', {
      session_id: sessionId,
      transactions: transactions.map((tx) => ({
        ...tx,
        timestamp: tx.timestamp ?? new Date().toISOString(),
      })),
    })
  }

  // ── User profile ─────────────────────────────────────────────────────────

  async getProfile(): Promise<UserProfileResponse> {
    return this.request<UserProfileResponse>('GET', '/user/profile')
  }

  // ── Session history ──────────────────────────────────────────────────────

  async getSessionHistory(limit = 20): Promise<SessionSummaryResponse[]> {
    return this.request<SessionSummaryResponse[]>('GET', `/sessions?limit=${limit}`)
  }

  // ── Platform health check ─────────────────────────────────────────────────

  async checkHealth(): Promise<{ status: 'ok' | 'degraded'; latencyMs: number }> {
    const start = Date.now()
    try {
      await this.request<unknown>('GET', '/health', undefined, { retries: 0, timeoutMs: 3_000 })
      return { status: 'ok', latencyMs: Date.now() - start }
    } catch {
      return { status: 'degraded', latencyMs: Date.now() - start }
    }
  }
}

export const extensionApi = new ExtensionAPI()

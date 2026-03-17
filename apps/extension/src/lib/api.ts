/**
 * Extension API client.
 * Communicates with the SweepBot backend from the extension context.
 * Handles auth token refresh, timeouts, and exponential-backoff retries.
 */

import { storage } from './storage'
import { createLogger } from './logger'

const log = createLogger('ExtensionApi')

const API_BASE =
  (typeof import.meta !== 'undefined'
    ? (import.meta.env as unknown as Record<string, string | undefined>)['VITE_API_URL']
    : undefined) ?? 'https://api.sweepbot.app'

/** Requests that should NOT be retried (state-mutating or auth). */
const NON_RETRY_METHODS = new Set(['POST', 'DELETE', 'PATCH'])
const REQUEST_TIMEOUT_MS = 10_000 // 10 s
const MAX_RETRIES = 2
const RETRY_BASE_DELAY_MS = 300

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

class ExtensionApi {
  async request<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
    const method = (options.method ?? 'GET').toUpperCase()
    const canRetry = !NON_RETRY_METHODS.has(method)
    let lastError: unknown

    for (let attempt = 0; attempt <= (canRetry ? MAX_RETRIES : 0); attempt++) {
      if (attempt > 0) {
        await sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1))
        log.debug('Retrying request', { path, attempt })
      }

      try {
        return await this._doRequest<T>(path, options)
      } catch (err) {
        lastError = err
        // Don't retry auth errors or client errors (4xx)
        if (err instanceof ApiError && err.status < 500) throw err
        if (err instanceof AuthExpiredError) throw err
        log.warn('Request failed, will retry if possible', {
          path,
          attempt,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    throw lastError
  }

  private async _doRequest<T>(path: string, options: RequestInit): Promise<T> {
    const authToken = await storage.get('authToken')
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    }

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    let response: Response
    try {
      response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
        signal: controller.signal,
      })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new ApiError(`Request timed out: ${path}`, 408)
      }
      throw err
    } finally {
      clearTimeout(timeoutId)
    }

    if (response.status === 401) {
      await storage.set('authToken', null)
      await storage.set('userId', null)
      throw new AuthExpiredError()
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({ message: 'Unknown error' }))
      throw new ApiError(body.message || `API error: ${response.status}`, response.status)
    }

    return response.json() as Promise<T>
  }

  // =========================================================================
  // Session endpoints
  // =========================================================================

  async createSession(platformSlug: string, gameId: string): Promise<{ sessionId: string }> {
    return this.request('/api/sessions', {
      method: 'POST',
      body: JSON.stringify({ platform_slug: platformSlug, game_id: gameId }),
    })
  }

  async updateSessionBalance(
    sessionId: string,
    scBalance: number,
    gcBalance: number
  ): Promise<void> {
    await this.request(`/api/sessions/${sessionId}/balance`, {
      method: 'PATCH',
      body: JSON.stringify({ sc_balance: scBalance, gc_balance: gcBalance }),
    })
  }

  async recordTransaction(
    sessionId: string,
    transaction: {
      game_id: string
      bet_amount: number
      win_amount: number
      result: 'win' | 'loss' | 'push'
    }
  ): Promise<void> {
    await this.request(`/api/sessions/${sessionId}/transactions`, {
      method: 'POST',
      body: JSON.stringify(transaction),
    })
  }

  async endSession(sessionId: string): Promise<{ rtp: number }> {
    return this.request(`/api/sessions/${sessionId}/end`, {
      method: 'POST',
    })
  }

  // =========================================================================
  // Analytics endpoints (for HUD data)
  // =========================================================================

  async getPlatformStats(platformSlug: string): Promise<{
    total_sessions: number
    total_wagered: number
    total_won: number
    rtp: number
  }> {
    return this.request(`/api/analytics/platform/${platformSlug}`)
  }

  async getSessionHistory(
    platformSlug: string,
    limit = 10
  ): Promise<
    Array<{
      session_id: string
      game_id: string
      started_at: string
      ended_at: string
      rtp: number
      wagered: number
      won: number
    }>
  > {
    return this.request(`/api/analytics/sessions?platform_slug=${platformSlug}&limit=${limit}`)
  }

  // =========================================================================
  // Jackpot endpoints (for live jackpot alerts)
  // =========================================================================

  async getActiveJackpots(platformSlug: string): Promise<
    Array<{
      jackpot_id: string
      game_id: string
      current_amount: number
      historical_high: number
      growth_rate: number
      last_hit_at: string
    }>
  > {
    return this.request(`/api/jackpots?platform_slug=${platformSlug}`)
  }

  // =========================================================================
  // User endpoints
  // =========================================================================

  async getCurrentUser(): Promise<{
    user_id: string
    email: string
    ref_code: string
    subscription_tier: string
  }> {
    return this.request('/api/users/me')
  }

  async getNotificationPreferences(): Promise<{
    enable_surge_alerts: boolean
    enable_jackpot_alerts: boolean
    enable_daily_digest: boolean
    enable_bonus_reminders: boolean
  }> {
    return this.request('/api/users/me/notification-prefs')
  }

  async updateNotificationPreferences(prefs: Record<string, boolean>): Promise<void> {
    await this.request('/api/users/me/notification-prefs', {
      method: 'PATCH',
      body: JSON.stringify(prefs),
    })
  }

  // =========================================================================
  // Affiliate endpoints
  // =========================================================================

  async trackAffiliateClick(platformSlug: string): Promise<void> {
    await this.request('/api/affiliate/click', {
      method: 'POST',
      body: JSON.stringify({ platform_slug: platformSlug }),
    })
  }

  async trackAffiliateSignup(platformSlug: string, externalUserId?: string): Promise<void> {
    await this.request('/api/affiliate/signup', {
      method: 'POST',
      body: JSON.stringify({
        platform_slug: platformSlug,
        external_user_id: externalUserId,
      }),
    })
  }
}

export const extensionApi = new ExtensionApi()

/**
 * Thrown when the server returns a non-2xx status.
 * Callers can branch on `error.status` to distinguish 4xx from 5xx.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** Thrown when the server returns 401 — auth token has expired or been revoked. */
export class AuthExpiredError extends Error {
  constructor() {
    super('Authentication expired')
    this.name = 'AuthExpiredError'
  }
}

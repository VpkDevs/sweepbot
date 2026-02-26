/**
 * Extension API client.
 * Communicates with the SweepBot backend from the extension context.
 * Handles auth token refresh and error handling.
 */

import { storage } from './storage'

const API_BASE = process.env.VITE_API_URL || 'https://api.sweepbot.app'

class ExtensionApi {
  async request<T = unknown>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const authToken = await storage.get('authToken')
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    }

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    })

    if (response.status === 401) {
      // Token expired
      await storage.set('authToken', null)
      await storage.set('userId', null)
      throw new Error('Authentication expired')
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }))
      throw new Error(error.message || `API error: ${response.status}`)
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
    gcBalance: number,
  ): Promise<void> {
    await this.request(`/api/sessions/${sessionId}/balance`, {
      method: 'PATCH',
      body: JSON.stringify({ sc_balance: scBalance, gc_balance: gcBalance }),
    })
  }

  async recordTransaction(sessionId: string, transaction: {
    game_id: string
    bet_amount: number
    win_amount: number
    result: 'win' | 'loss' | 'push'
  }): Promise<void> {
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

  async getSessionHistory(platformSlug: string, limit = 10): Promise<Array<{
    session_id: string
    game_id: string
    started_at: string
    ended_at: string
    rtp: number
    wagered: number
    won: number
  }>> {
    return this.request(
      `/api/analytics/sessions?platform_slug=${platformSlug}&limit=${limit}`,
    )
  }

  // =========================================================================
  // Jackpot endpoints (for live jackpot alerts)
  // =========================================================================

  async getActiveJackpots(platformSlug: string): Promise<Array<{
    jackpot_id: string
    game_id: string
    current_amount: number
    historical_high: number
    growth_rate: number
    last_hit_at: string
  }>> {
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

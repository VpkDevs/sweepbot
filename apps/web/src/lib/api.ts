import type { ApiResponse } from '@sweepbot/types'
import { supabase } from './supabase'

const API_BASE = import.meta.env.VITE_API_URL ?? '/api/v1'

class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status?: number
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function getAuthHeaders(): Promise<Record<string, string>> {
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

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await getAuthHeaders()

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { ...headers, ...options.headers },
    })

    const json = (await response.json()) as ApiResponse<T>

    if (!json.success) {
      throw new ApiError(json.error.code, json.error.message, response.status)
    }

    return json.data
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (error instanceof SyntaxError) {
      throw new ApiError('PARSE_ERROR', 'Failed to parse server response', 500)
    }
    if (error instanceof TypeError) {
      throw new ApiError('NETWORK_ERROR', 'Network request failed', 0)
    }
    throw error
  }
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
    platforms: () => request<unknown[]>('/user/platforms'),
    addPlatform: (data: Record<string, unknown>) =>
      request('/user/platforms', { method: 'POST', body: JSON.stringify(data) }),
    removePlatform: (id: string) =>
      request(`/user/platforms/${id}`, { method: 'DELETE' }),

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
      return request<unknown[]>(`/platforms${qs}`)
    },
    get: (id: string) => request<Record<string, unknown>>(`/platforms/${id}`),
    games: (id: string, params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : ''
      return request<unknown[]>(`/platforms/${id}/games${qs}`)
    },
    tosHistory: (id: string) => request<unknown[]>(`/platforms/${id}/tos-history`),
  },

  // Sessions
  sessions: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : ''
      return request<unknown[]>(`/sessions${qs}`)
    },
    get: (id: string) => request<Record<string, unknown>>(`/sessions/${id}`),
    create: (data: Record<string, unknown>) =>
      request('/sessions', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Record<string, unknown>) =>
      request(`/sessions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
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
    temporal: () => request<Record<string, unknown>>('/analytics/temporal'),
    bonus: () => request<unknown[]>('/analytics/bonus'),
  },

  // Jackpots
  jackpots: {
    leaderboard: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : ''
      return request<unknown[]>(`/jackpots${qs}`)
    },
    history: (gameId: string) =>
      request<Record<string, unknown>>(`/jackpots/${gameId}/history`),
    stats: () => request<Record<string, unknown>>('/jackpots/stats'),
  },

  // Redemptions
  redemptions: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : ''
      return request<unknown[]>(`/redemptions${qs}`)
    },
    create: (data: Record<string, unknown>) =>
      request('/redemptions', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Record<string, unknown>) =>
      request(`/redemptions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    stats: () => request<Record<string, unknown>>('/redemptions/stats'),
    communityBenchmarks: () => request<unknown[]>('/redemptions/community-benchmarks'),
  },

  // Trust Index
  trust: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : ''
      return request<unknown[]>(`/trust-index${qs}`)
    },
    get: (platformId: string) =>
      request<Record<string, unknown>>(`/trust-index/${platformId}`),
  },

  // Phase 2 Features
  features: {
    achievements: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : ''
      return request<unknown[]>(`/features/achievements${qs}`)
    },
    myAchievements: () => request<unknown[]>('/features/achievements/mine'),
    achievementLeaderboard: () => request<unknown[]>('/features/achievements/leaderboard'),
    checkAchievements: () => request<Record<string, unknown>>('/features/achievements/check', { method: 'POST' }),
    heatmap: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : ''
      return request<unknown[]>(`/features/heatmap${qs}`)
    },
    streaks: () => request<Record<string, unknown>>('/features/streaks'),
    records: () => request<Record<string, unknown>>('/features/records'),
    refreshRecords: () => request<Record<string, unknown>>('/features/records/refresh', { method: 'POST' }),
    bigWins: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : ''
      return request<unknown[]>(`/features/big-wins${qs}`)
    },
    submitBigWin: (data: Record<string, unknown>) =>
      request<Record<string, unknown>>('/features/big-wins', { method: 'POST', body: JSON.stringify(data) }),
    myBigWins: () => request<unknown[]>('/features/big-wins/mine'),
    updateBigWin: (id: string, data: Record<string, unknown>) =>
      request<Record<string, unknown>>(`/features/big-wins/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    stats: () => request<Record<string, unknown>>('/features/stats'),
  },

  // Flows
  flows: {
    list: (params?: { page?: number; pageSize?: number }) => {
      const qs = params
        ? '?' + new URLSearchParams(
            Object.fromEntries(
              Object.entries(params)
                .filter(([, v]) => v !== undefined)
                .map(([k, v]) => [k, String(v)])
            )
          ).toString()
        : ''
      return request<unknown[]>(`/flows${qs}`)
    },
    get: (id: string) => request<Record<string, unknown>>(`/flows/${id}`),
    create: (data: Record<string, unknown>) =>
      request<Record<string, unknown>>('/flows', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Record<string, unknown>) =>
      request<Record<string, unknown>>(`/flows/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    interpret: (rawInput: string) =>
      request<Record<string, unknown>>('/flows/interpret', {
        method: 'POST',
        body: JSON.stringify({ rawInput }),
      }),
    converse: (conversationId: string, userMessage: string) =>
      request<Record<string, unknown>>('/flows/converse', {
        method: 'POST',
        body: JSON.stringify({ conversationId, userMessage }),
      }),
    execute: (id: string) =>
      request<Record<string, unknown>>(`/flows/${id}/execute`, { method: 'POST' }),
    executions: (id: string, params?: { page?: number; pageSize?: number }) => {
      const qs = params
        ? '?' + new URLSearchParams(
            Object.fromEntries(
              Object.entries(params)
                .filter(([, v]) => v !== undefined)
                .map(([k, v]) => [k, String(v)])
            )
          ).toString()
        : ''
      return request<unknown[]>(`/flows/${id}/executions${qs}`)
    },
    delete: (id: string) => request<{ deleted: boolean }>(`/flows/${id}`, { method: 'DELETE' }),
  },

  // Notifications
  notifications: {
    list: (params?: { limit?: number; unread_only?: boolean }) => {
      const qs = params
        ? '?' + new URLSearchParams(
            Object.fromEntries(
              Object.entries(params)
                .filter(([, v]) => v !== undefined)
                .map(([k, v]) => [k, String(v)])
            )
          ).toString()
        : ''
      return request<unknown[]>(`/notifications${qs}`)
    },
    count: () => request<{ unread: number }>('/notifications/count'),
    markRead: (id: string) =>
      request<{ id: string }>(`/notifications/${id}/read`, { method: 'PATCH' }),
    markAllRead: () =>
      request<{ marked: boolean }>('/notifications/read-all', { method: 'POST' }),
    delete: (id: string) =>
      request<{ deleted: boolean }>(`/notifications/${id}`, { method: 'DELETE' }),
  },
}

export { ApiError }

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

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers, ...options.headers },
  })

  const json = (await response.json()) as ApiResponse<T>

  if (!json.success) {
    throw new ApiError(json.error.code, json.error.message, response.status)
  }

  return json.data
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
}

export { ApiError }

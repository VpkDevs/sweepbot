/**
 * Enhanced API Client with Retry Logic and Better Error Handling
 * Improvements over base api.ts:
 * - Exponential backoff retry for network errors
 * - Request/response interceptors
 * - Structured error types
 * - Request deduplication
 * - Timeout handling
 */

import type { ApiResponse } from '@sweepbot/types'
import { supabaseClient, supabaseStub } from './supabase'
import { logger } from '@sweepbot/utils'

const API_BASE = import.meta.env.VITE_API_URL ?? '/api/v1'

// Custom error types for better error handling
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
  constructor(message = 'Network request failed') {
    super('NETWORK_ERROR', message, 0)
    this.name = 'NetworkError'
  }
}

export class TimeoutError extends ApiError {
  constructor(message = 'Request timed out') {
    super('TIMEOUT_ERROR', message, 408)
    this.name = 'TimeoutError'
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Unauthorized') {
    super('UNAUTHORIZED', message, 401)
    this.name = 'UnauthorizedError'
  }
}

// Use supabaseClient which handles the null case
const getSupabase = () => supabaseClient ?? supabaseStub

// In-flight request cache for deduplication
const pendingRequests = new Map<string, Promise<unknown>>()

interface RequestConfig extends RequestInit {
  timeout?: number
  retries?: number
  retryDelay?: number
  skipCache?: boolean
}

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

/**
 * Exponential backoff delay calculation
 */
function calculateRetryDelay(attempt: number, baseDelay = 1000): number {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  const jitter = (buf[0]! / 2 ** 32) * 1000
  return Math.min(baseDelay * Math.pow(2, attempt), 10000) + jitter
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function toQS(params?: Record<string, string | number | boolean | undefined>): string {
  if (!params) return ''
  const filtered = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
  )
  const qs = new URLSearchParams(filtered).toString()
  return qs ? `?${qs}` : ''
}

/**
 * Enhanced fetch with timeout support
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout = 30000
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    return response
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TimeoutError(`Request timed out after ${timeout}ms`)
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Enhanced request function with retry logic
 */
async function request<T>(
  path: string,
  config: RequestConfig = {}
): Promise<T> {
  const {
    timeout = 30000,
    retries = 3,
    retryDelay = 1000,
    skipCache = false,
    ...options
  } = config

  const cacheKey = `${options.method || 'GET'}:${path}:${JSON.stringify(options.body)}`
  
  // Check for in-flight duplicate request
  if (!skipCache && (!options.method || options.method === 'GET')) {
    const pending = pendingRequests.get(cacheKey)
    if (pending) {
      logger.debug('Request deduplicated', { path, method: options.method })
      return pending as Promise<T>
    }
  }

  const executeRequest = async (attempt = 0): Promise<T> => {
    try {
      const headers = await getAuthHeaders()
      const url = `${API_BASE}${path}`

      logger.debug('API request', { 
        method: options.method || 'GET', 
        path, 
        attempt: attempt + 1 
      })

      const response = await fetchWithTimeout(
        url,
        {
          ...options,
          headers: { ...headers, ...options.headers },
        },
        timeout
      )

      // Handle 401 Unauthorized
      if (response.status === 401) {
        throw new UnauthorizedError('Session expired. Please log in again.')
      }

      const json = (await response.json()) as ApiResponse<T>

      if (!json.success) {
        const error = new ApiError(
          json.error.code,
          json.error.message,
          response.status,
          json.error.details
        )
        
        logger.error('API error response', {
          path,
          code: json.error.code,
          message: json.error.message,
          status: response.status,
        })
        
        throw error
      }

      logger.debug('API request successful', { path })
      return json.data
      
    } catch (error) {
      // Don't retry on client errors (4xx) or specific error types
      const shouldRetry =
        attempt < retries &&
        !(error instanceof UnauthorizedError) &&
        !(error instanceof ApiError && error.status && error.status >= 400 && error.status < 500)

      if (shouldRetry) {
        const delay = calculateRetryDelay(attempt, retryDelay)
        logger.warn('API request failed, retrying', {
          path,
          attempt: attempt + 1,
          retries,
          delayMs: delay,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        
        await sleep(delay)
        return executeRequest(attempt + 1)
      }

      // Final error handling
      if (error instanceof ApiError) {
        throw error
      }
      
      if (error instanceof TypeError) {
        throw new NetworkError('Network request failed. Check your connection.')
      }
      
      if (error instanceof SyntaxError) {
        throw new ApiError('PARSE_ERROR', 'Failed to parse server response', 500)
      }

      // Unknown error
      logger.error('Unexpected API error', {
        path,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      
      throw new ApiError(
        'UNKNOWN_ERROR',
        error instanceof Error ? error.message : 'An unexpected error occurred',
        500
      )
    }
  }

  // Create promise and cache it for GET requests
  const requestPromise = executeRequest()
  
  if (!skipCache && (!options.method || options.method === 'GET')) {
    pendingRequests.set(cacheKey, requestPromise)
    requestPromise.finally(() => {
      pendingRequests.delete(cacheKey)
    })
  }

  return requestPromise
}

// ─── Typed API client (keep existing endpoints) ───────────────────────────────
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
  },

  // Auth
  auth: {
    signIn: (email: string, password: string) =>
      request<{ user: Record<string, unknown>; session: Record<string, unknown> }>('/auth/sign-in', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    signUp: (email: string, password: string) =>
      request<{ user: Record<string, unknown> }>('/auth/sign-up', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    refresh: (refreshToken: string) =>
      request<{ session: Record<string, unknown> }>('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refreshToken }),
      }),
  },

  // Sessions
  sessions: {
    list: (params?: { page?: number; limit?: number; platformId?: string }) => {
      return request<unknown[]>(`/sessions${toQS(params)}`)
    },
    get: (id: string) => request<Record<string, unknown>>(`/sessions/${id}`),
    create: (data: Record<string, unknown>) =>
      request<Record<string, unknown>>('/sessions', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Record<string, unknown>) =>
      request<Record<string, unknown>>(`/sessions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    end: (id: string) =>
      request<Record<string, unknown>>(`/sessions/${id}/end`, { method: 'POST' }),
    delete: (id: string) => request(`/sessions/${id}`, { method: 'DELETE' }),
  },

  // Analytics
  analytics: {
    portfolio: () => request<Record<string, unknown>>('/analytics/portfolio'),
    platforms: () => request<unknown[]>('/analytics/platforms'),
    dashboard: () => request<Record<string, unknown>>('/analytics/dashboard'),
    heatmap: (params?: { year?: number }) => {
      const qs = params?.year ? `?year=${params.year}` : ''
      return request<unknown[]>(`/analytics/heatmap${qs}`)
    },
  },

  // Platforms
  platforms: {
    list: () => request<unknown[]>('/platforms'),
    get: (id: string) => request<Record<string, unknown>>(`/platforms/${id}`),
    stats: (id: string) => request<Record<string, unknown>>(`/platforms/${id}/stats`),
  },

  // Jackpots
  jackpots: {
    list: (params?: { page?: number; limit?: number; platform?: string }) => {
      return request<unknown[]>(`/jackpots${toQS(params)}`)
    },
    history: (id: string) => request<unknown[]>(`/jackpots/${id}/history`),
    leaderboard: () => request<unknown[]>('/jackpots/leaderboard'),
    report: (data: Record<string, unknown>) =>
      request('/jackpots', { method: 'POST', body: JSON.stringify(data) }),
  },

  // Redemptions
  redemptions: {
    list: (params?: { page?: number; limit?: number; status?: string }) => {
      return request<unknown[]>(`/redemptions${toQS(params)}`)
    },
    get: (id: string) => request<Record<string, unknown>>(`/redemptions/${id}`),
    create: (data: Record<string, unknown>) =>
      request<Record<string, unknown>>('/redemptions', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Record<string, unknown>) =>
      request<Record<string, unknown>>(`/redemptions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request(`/redemptions/${id}`, { method: 'DELETE' }),
  },

  // Trust Index
  trust: {
    list: () => request<unknown[]>('/trust-index'),
    get: (platform: string) => request<Record<string, unknown>>(`/trust-index/${platform}`),
    vote: (platform: string, rating: number, comment?: string) =>
      request('/trust-index/vote', { method: 'POST', body: JSON.stringify({ platform, rating, comment }) }),
  },

  // Flows
  flows: {
    list: () => request<unknown[]>('/flows'),
    get: (id: string) => request<Record<string, unknown>>(`/flows/${id}`),
    create: (data: Record<string, unknown>) =>
      request<Record<string, unknown>>('/flows', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Record<string, unknown>) =>
      request<Record<string, unknown>>(`/flows/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request(`/flows/${id}`, { method: 'DELETE' }),
    execute: (id: string) =>
      request<Record<string, unknown>>(`/flows/${id}/execute`, { method: 'POST' }),
    executions: (id: string) => request<unknown[]>(`/flows/${id}/executions`),
    interpret: (message: string, conversationId?: string) =>
      request<Record<string, unknown>>('/flows/interpret', {
        method: 'POST',
        body: JSON.stringify({ message, conversation_id: conversationId }),
      }),
  },

  // Features
  features: {
    achievements: () => request<unknown[]>('/features/achievements'),
    streaks: () => request<Record<string, unknown>>('/features/streaks'),
    records: () => request<unknown[]>('/features/records'),
    bigWins: (params?: { page?: number; limit?: number }) => {
      return request<unknown[]>(`/features/big-wins${toQS(params)}`)
    },
    heatmap: () => request<unknown[]>('/features/heatmap'),
  },

  // Notifications
  notifications: {
    list: (params?: { page?: number; limit?: number; unreadOnly?: boolean }) => {
      return request<unknown[]>(`/notifications${toQS(params)}`)
    },
    markRead: (id: string) =>
      request(`/notifications/${id}/read`, { method: 'POST' }),
    markAllRead: () =>
      request('/notifications/read-all', { method: 'POST' }),
    delete: (id: string) =>
      request(`/notifications/${id}`, { method: 'DELETE' }),
  },

  // Export error classes for usage in components
  ApiError,
  NetworkError,
  TimeoutError,
  UnauthorizedError,
}

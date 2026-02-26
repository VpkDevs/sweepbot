import { z } from 'zod'

// ─────────────────────────────────────────────────────────────────────────────
// API RESPONSE WRAPPERS
// ─────────────────────────────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  success: true
  data: T
  meta?: {
    page?: number
    pageSize?: number
    total?: number
    hasMore?: boolean
  }
}

export interface ApiError {
  success: false
  error: {
    code: string
    message: string
    details?: unknown
  }
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError

// ─────────────────────────────────────────────────────────────────────────────
// PAGINATION
// ─────────────────────────────────────────────────────────────────────────────

export const PaginationParamsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type PaginationParams = z.infer<typeof PaginationParamsSchema>

// ─────────────────────────────────────────────────────────────────────────────
// WEBSOCKET MESSAGE TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type WSMessageType =
  | 'session:start'
  | 'session:update'
  | 'session:end'
  | 'jackpot:subscribe'
  | 'jackpot:unsubscribe'
  | 'jackpot:update'
  | 'session:ack'
  | 'trust:update'
  | 'notification'
  | 'error'
  | 'ping'
  | 'pong'

export interface WSMessage<T = unknown> {
  type: WSMessageType
  payload: T
  timestamp: string
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE GATE ERRORS
// ─────────────────────────────────────────────────────────────────────────────

export const API_ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  FEATURE_GATED: 'FEATURE_GATED',
  SUBSCRIPTION_REQUIRED: 'SUBSCRIPTION_REQUIRED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES]

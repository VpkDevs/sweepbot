/**
 * Common types used across the application
 */

export type LoadingState = 'idle' | 'loading' | 'success' | 'error'

export interface PaginationMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface FilterOptions {
  [key: string]: string | number | boolean | string[]
}

export type SortDirection = 'asc' | 'desc'

export interface SortOptions {
  field: string
  direction: SortDirection
}

export interface ApiErrorResponse {
  error: string
  message: string
  status: number
  timestamp?: string
}

export type NotificationType = 'success' | 'error' | 'warning' | 'info'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  timestamp: number
  read: boolean
}

export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'cancelled'

export type PlatformStatus = 'connected' | 'disconnected' | 'error' | 'pending'

export type SubscriptionTier = 'free' | 'starter' | 'pro' | 'analyst' | 'elite'

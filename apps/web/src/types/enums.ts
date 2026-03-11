/**
 * Enumeration-like types for the application
 */

export const FILTER_TYPES = {
  TEXT: 'text',
  NUMBER: 'number',
  SELECT: 'select',
  DATE: 'date',
  RANGE: 'range',
} as const

export type FilterType = (typeof FILTER_TYPES)[keyof typeof FILTER_TYPES]

export const SORT_DIRECTIONS = {
  ASC: 'asc',
  DESC: 'desc',
} as const

export type SortDirection = (typeof SORT_DIRECTIONS)[keyof typeof SORT_DIRECTIONS]

export const NOTIFICATION_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
} as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES]

export const TRANSACTION_STATUSES = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const

export type TransactionStatus = (typeof TRANSACTION_STATUSES)[keyof typeof TRANSACTION_STATUSES]

export const PLATFORM_STATUSES = {
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  ERROR: 'error',
  PENDING: 'pending',
} as const

export type PlatformStatus = (typeof PLATFORM_STATUSES)[keyof typeof PLATFORM_STATUSES]

export const SUBSCRIPTION_TIERS = {
  FREE: 'free',
  STARTER: 'starter',
  PRO: 'pro',
  ANALYST: 'analyst',
  ELITE: 'elite',
} as const

export type SubscriptionTier = (typeof SUBSCRIPTION_TIERS)[keyof typeof SUBSCRIPTION_TIERS]

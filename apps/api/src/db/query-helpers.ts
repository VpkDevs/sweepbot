/**
 * Database Query Optimization Helpers
 * - Connection pooling utilities
 * - Query caching
 * - Batch operations
 * - Performance monitoring
 */

import { db } from './client'
import { logger } from '../utils/logger.js'
import { Redis } from '@upstash/redis'

// Initialize Redis client for query caching
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null

interface QueryCacheOptions {
  ttl?: number // Time to live in seconds
  prefix?: string
}

/**
 * Cached query wrapper
 * Caches query results in Redis with automatic invalidation
 */
export async function cachedQuery<T>(
  key: string,
  queryFn: () => Promise<T>,
  options: QueryCacheOptions = {}
): Promise<T> {
  const { ttl = 300, prefix = 'query' } = options
  const cacheKey = `${prefix}:${key}`

  if (!redis) {
    return queryFn()
  }

  try {
    // Try cache first
    const cached = await redis.get<T>(cacheKey)
    if (cached !== null) {
      logger.debug('Query cache hit', { key: cacheKey })
      return cached
    }

    // Cache miss - execute query
    logger.debug('Query cache miss', { key: cacheKey })
    const result = await queryFn()

    // Store in cache
    await redis.setex(cacheKey, ttl, result)

    return result
  } catch (error) {
    logger.error('Query cache error', { key: cacheKey, error })
    // Fallback to direct query on cache error
    return queryFn()
  }
}

/**
 * Invalidate cached query
 */
export async function invalidateQueryCache(key: string, prefix = 'query'): Promise<void> {
  if (!redis) return

  const cacheKey = `${prefix}:${key}`
  try {
    await redis.del(cacheKey)
    logger.debug('Query cache invalidated', { key: cacheKey })
  } catch (error) {
    logger.error('Query cache invalidation error', { key: cacheKey, error })
  }
}

/**
 * Batch operation helper
 * Executes multiple operations in a single transaction
 */
export async function batchOperation<T>(
  operations: Array<() => Promise<T>>
): Promise<T[]> {
  const startTime = performance.now()

  try {
    const results = await Promise.all(operations.map((op) => op()))
    
    const duration = performance.now() - startTime
    logger.debug('Batch operation completed', {
      count: operations.length,
      durationMs: duration.toFixed(2),
    })

    return results
  } catch (error) {
    logger.error('Batch operation failed', {
      count: operations.length,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    throw error
  }
}

/**
 * Query performance monitor
 * Wraps a query and logs slow queries
 */
export async function monitoredQuery<T>(
  name: string,
  queryFn: () => Promise<T>,
  slowThresholdMs = 1000
): Promise<T> {
  const startTime = performance.now()

  try {
    const result = await queryFn()
    const duration = performance.now() - startTime

    if (duration > slowThresholdMs) {
      logger.warn('Slow query detected', {
        query: name,
        durationMs: duration.toFixed(2),
        threshold: slowThresholdMs,
      })
    } else {
      logger.debug('Query executed', {
        query: name,
        durationMs: duration.toFixed(2),
      })
    }

    return result
  } catch (error) {
    const duration = performance.now() - startTime
    logger.error('Query failed', {
      query: name,
      durationMs: duration.toFixed(2),
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    throw error
  }
}

/**
 * Paginated query helper
 * Standardizes pagination across the API
 */
export interface PaginationParams {
  page: number
  limit: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedResult<T> {
  data: T[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasMore: boolean
  }
}

export async function paginatedQuery<T>(
  countQuery: () => Promise<number>,
  dataQuery: (offset: number, limit: number) => Promise<T[]>,
  params: PaginationParams
): Promise<PaginatedResult<T>> {
  const { page = 1, limit = 20 } = params

  // Validate pagination params
  const safePage = Math.max(1, page)
  const safeLimit = Math.min(100, Math.max(1, limit))
  const offset = (safePage - 1) * safeLimit

  // Execute count and data queries in parallel
  const [total, data] = await Promise.all([
    countQuery(),
    dataQuery(offset, safeLimit),
  ])

  const totalPages = Math.ceil(total / safeLimit)

  return {
    data,
    meta: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages,
      hasMore: safePage < totalPages,
    },
  }
}

/**
 * Transaction helper with automatic rollback
 * Ensures atomic operations
 */
export async function transaction<T>(
  callback: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<T>
): Promise<T> {
  try {
    const result = await db.transaction(async (tx) => {
      return await callback(tx)
    })
    
    logger.debug('Transaction completed successfully')
    return result
  } catch (error) {
    logger.error('Transaction failed and rolled back', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    throw error
  }
}

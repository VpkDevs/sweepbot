/**
 * Test Setup Utilities for SweepBot API
 * Provides mocks, fixtures, and helper functions for testing
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { FastifyRequest, FastifyReply } from 'fastify'

/* ─────────────────────────────────────────────────────────────────────────── */
/* Test Data Builders */
/* ─────────────────────────────────────────────────────────────────────────── */

export interface TestUser {
  id: string
  email: string
  tier: 'free' | 'starter' | 'pro' | 'analyst' | 'elite' | 'lifetime'
}

export interface TestSubscription {
  userId: string
  stripeId: string
  stripeCustomerId: string
  tier: string
  status: 'active' | 'trailing' | 'on_hold' | 'canceled' | 'expired'
  currentPeriodStart: Date
  currentPeriodEnd: Date
}

export interface TestFlow {
  id: string
  userId: string
  name: string
  description: string
  status: 'draft' | 'active' | 'paused' | 'archived'
  definition: unknown
  createdAt: Date
  updatedAt: Date
}

export interface TestFlowExecution {
  id: string
  flowId: string
  userId: string
  status: 'running' | 'completed' | 'failed' | 'paused'
  startedAt: Date
  completedAt?: Date
  metrics?: unknown
  errorDetails?: string
}

/**
 * Create a test user with sensible defaults
 */
export function createTestUser(overrides?: Partial<TestUser>): TestUser {
  return {
    id: 'user-test-001',
    email: 'test@example.com',
    tier: 'starter',
    ...overrides,
  }
}

/**
 * Create a test subscription with sensible defaults
 */
export function createTestSubscription(overrides?: Partial<TestSubscription>): TestSubscription {
  const now = new Date()
  const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  return {
    userId: 'user-test-001',
    stripeId: 'sub_test_12345',
    stripeCustomerId: 'cus_test_12345',
    tier: 'starter',
    status: 'active',
    currentPeriodStart: now,
    currentPeriodEnd: nextMonth,
    ...overrides,
  }
}

/**
 * Create a test flow with sensible defaults
 */
export function createTestFlow(overrides?: Partial<TestFlow>): TestFlow {
  const now = new Date()
  return {
    id: 'flow-test-001',
    userId: 'user-test-001',
    name: 'Test Flow',
    description: 'A test automation flow',
    status: 'draft',
    definition: {
      type: 'sequence',
      steps: [
        { type: 'action', action: 'open_platform', platform: 'chumba' },
        { type: 'action', action: 'claim_bonus' },
      ],
    },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

/**
 * Create a test flow execution with sensible defaults
 */
export function createTestFlowExecution(overrides?: Partial<TestFlowExecution>): TestFlowExecution {
  const now = new Date()
  return {
    id: 'exec-test-001',
    flowId: 'flow-test-001',
    userId: 'user-test-001',
    status: 'completed',
    startedAt: now,
    completedAt: now,
    metrics: {
      duration: 5000,
      actions: 2,
      success: true,
    },
    ...overrides,
  }
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Supabase Mocks */
/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * Mock Supabase Auth client
 * Returns realistic responses for JWT validation
 */
export const createMockSupabaseAuth = () => ({
  getUser: vi.fn().mockResolvedValue({
    data: {
      user: {
        id: 'user-test-001',
        email: 'test@example.com',
        user_metadata: { tier: 'starter' },
      },
    },
    error: null,
  }),
})

/**
 * Mock Supabase Database client
 * Returns realistic responses for queries
 */
export const createMockSupabaseDb = () => ({
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: [createTestUser()],
        error: null,
      }),
    }),
    insert: vi.fn().mockResolvedValue({
      data: [createTestUser()],
      error: null,
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: [createTestUser()],
        error: null,
      }),
    }),
    delete: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    }),
  }),
})

/**
 * Mock Supabase client (auth + db combined)
 */
export const createMockSupabaseClient = () => ({
  auth: createMockSupabaseAuth(),
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    }),
    insert: vi.fn().mockResolvedValue({
      data: [],
      error: null,
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    }),
  }),
})

/* ─────────────────────────────────────────────────────────────────────────── */
/* Stripe Mocks */
/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * Create a mock Stripe webhook event
 */
export function createMockStripeEvent(eventType: string, data?: Record<string, unknown>) {
  return {
    id: 'evt_test_123456',
    object: 'event',
    api_version: '2023-10-16',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: 'sub_test_123456',
        object: 'subscription',
        status: 'active',
        customer: 'cus_test_123456',
        ...data,
      },
    },
    livemode: false,
    pending_webhooks: 1,
    request: {
      id: null,
      idempotency_key: null,
    },
    type: eventType,
  }
}

/**
 * Create a mock Stripe customer event
 */
export function createMockStripeCustomerEvent(
  eventType: string,
  customData?: Record<string, unknown>
) {
  return {
    id: 'evt_test_customer_001',
    object: 'event',
    api_version: '2023-10-16',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: 'cus_test_001',
        object: 'customer',
        email: 'test@example.com',
        metadata: { user_id: 'user-test-001' },
        ...customData,
      },
    },
    livemode: false,
    pending_webhooks: 1,
    request: {
      id: null,
      idempotency_key: null,
    },
    type: eventType,
  }
}

/**
 * Mock Stripe client
 */
export const createMockStripClient = () => ({
  customers: {
    create: vi.fn().mockResolvedValue({
      id: 'cus_test_123456',
      email: 'test@example.com',
      metadata: { user_id: 'user-test-001' },
    }),
    retrieve: vi.fn().mockResolvedValue({
      id: 'cus_test_123456',
      email: 'test@example.com',
    }),
    update: vi.fn().mockResolvedValue({
      id: 'cus_test_123456',
      email: 'test@example.com',
    }),
  },
  subscriptions: {
    create: vi.fn().mockResolvedValue({
      id: 'sub_test_123456',
      customer: 'cus_test_123456',
      status: 'active',
      current_period_start: Math.floor(Date.now() / 1000),
      current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    }),
    retrieve: vi.fn().mockResolvedValue({
      id: 'sub_test_123456',
      status: 'active',
    }),
    update: vi.fn().mockResolvedValue({
      id: 'sub_test_123456',
      status: 'active',
    }),
  },
  webhooks: {
    constructEvent: vi.fn().mockImplementation((body, sig, secret) => {
      // In tests, just parse the body as is
      return typeof body === 'string' ? JSON.parse(body) : body
    }),
  },
})

/* ─────────────────────────────────────────────────────────────────────────── */
/* Fastify Test Helpers */
/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * Create a mock FastifyRequest with user context
 */
export function createMockFastifyRequest(overrides?: Partial<FastifyRequest>): FastifyRequest {
  return {
    headers: {
      authorization: 'Bearer test-jwt-token-123',
    },
    user: createTestUser(),
    url: '/api/test',
    method: 'GET',
    ip: '127.0.0.1',
    ...overrides,
  } as FastifyRequest
}

/**
 * Create a mock FastifyReply
 */
export function createMockFastifyReply(overrides?: Partial<FastifyReply>): FastifyReply {
  const mockReply: Partial<FastifyReply> = {
    code: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    header: vi.fn().mockReturnThis(),
    ...overrides,
  }
  return mockReply as FastifyReply
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Database Test Helpers */
/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * Mock database client with common database operations
 */
export const createMockDatabaseClient = () => ({
  users: {
    create: vi.fn().mockResolvedValue(createTestUser()),
    findById: vi.fn().mockResolvedValue(createTestUser()),
    update: vi.fn().mockResolvedValue(createTestUser()),
    delete: vi.fn().mockResolvedValue(true),
  },
  subscriptions: {
    create: vi.fn().mockResolvedValue(createTestSubscription()),
    findByUserId: vi.fn().mockResolvedValue(createTestSubscription()),
    update: vi.fn().mockResolvedValue(createTestSubscription()),
  },
  flows: {
    create: vi.fn().mockResolvedValue(createTestFlow()),
    findById: vi.fn().mockResolvedValue(createTestFlow()),
    findByUserId: vi.fn().mockResolvedValue([createTestFlow()]),
    update: vi.fn().mockResolvedValue(createTestFlow()),
    delete: vi.fn().mockResolvedValue(true),
  },
  flowExecutions: {
    create: vi.fn().mockResolvedValue(createTestFlowExecution()),
    findById: vi.fn().mockResolvedValue(createTestFlowExecution()),
    findByFlowId: vi.fn().mockResolvedValue([createTestFlowExecution()]),
    update: vi.fn().mockResolvedValue(createTestFlowExecution()),
  },
})

/* ─────────────────────────────────────────────────────────────────────────── */
/* Common Test Assertions */
/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * Assert that a response has the expected success structure
 */
export function assertSuccessResponse(response: unknown) {
  expect(response).toBeDefined()
  expect((response as Record<string, unknown>)['success']).toBe(true)
  expect((response as Record<string, unknown>)['data']).toBeDefined()
}

/**
 * Assert that a response has the expected error structure
 */
export function assertErrorResponse(response: unknown, expectedCode?: string) {
  expect(response).toBeDefined()
  expect((response as Record<string, unknown>)['success']).toBe(false)
  expect((response as Record<string, unknown>)['error']).toBeDefined()
  const err = (response as Record<string, Record<string, unknown>>)['error']
  expect(err?.['code']).toBeDefined()
  expect(err?.['message']).toBeDefined()
  if (expectedCode) {
    expect(err?.['code']).toBe(expectedCode)
  }
}

/**
 * Assert that user data is sanitized (no sensitive fields)
 */
export function assertUserSanitized(user: unknown) {
  const u = user as Record<string, unknown>
  expect(u).toBeDefined()
  expect(u['id']).toBeDefined()
  // Should NOT include:
  expect(u['password']).toBeUndefined()
  expect(u['passwordHash']).toBeUndefined()
  expect(u['stripeSecretKey']).toBeUndefined()
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Test Helpers for Common Patterns */
/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * Helper to test that an async operation tracks errors correctly
 */
export async function testAsyncErrorTracking(
  operation: () => Promise<unknown>,
  expectedError?: string
) {
  try {
    await operation()
    throw new Error('Expected operation to throw')
  } catch (error: unknown) {
    if (expectedError) {
      expect((error as Error).message).toContain(expectedError)
    }
  }
}

/**
 * Helper to test that concurrent operations don't interfere
 */
export async function testConcurrentOperations(
  operation: (id: string) => Promise<unknown>,
  count: number = 5
) {
  const promises = Array.from({ length: count }, (_, i) => operation(`test-${i}`))
  const results = await Promise.all(promises)
  return results
}

import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../db/client', () => ({
  query: vi.fn(),
  unsafeQuery: vi.fn(),
}))

vi.mock('../../middleware/auth', () => ({
  requireAuth: vi.fn(),
}))

vi.mock('../../utils/env', () => ({
  env: {
    STRIPE_SECRET_KEY: 'sk_test_mock',
    CORS_ORIGINS: 'https://app.sweepbot.test',
  },
}))

vi.mock('../../services/stripe.service', () => ({
  createCheckoutSession: vi.fn(),
  createPortalSession: vi.fn(),
  changeSubscriptionPlan: vi.fn(),
  cancelSubscription: vi.fn(),
  reactivateSubscription: vi.fn(),
  applyPromotionCode: vi.fn(),
  StripeServiceError: class StripeServiceError extends Error {
    code: string

    constructor(code: string, message: string) {
      super(message)
      this.code = code
    }
  },
}))

vi.mock('stripe', () => ({
  default: class StripeMock {
    subscriptions = {
      cancel: vi.fn(),
    }
  },
}))

import { query as dbQuery, unsafeQuery } from '../../db/client'
import { requireAuth } from '../../middleware/auth'
import { userRoutes } from '../../routes/user'

function createMockUser() {
  return { id: 'user-test-001', email: 'test@example.com', tier: 'free' }
}

describe('User routes sanitization', () => {
  let app: ReturnType<typeof Fastify>

  beforeEach(async () => {
    vi.mocked(requireAuth).mockImplementation(async (req) => {
      req.user = createMockUser()
    })

    app = Fastify()
    app.decorateRequest('user', null)
    app.register(userRoutes, { prefix: '/user' })
    await app.ready()
  })

  it('rejects tag-only display names after sanitization', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/user/profile',
      payload: { displayName: '<script></script>' },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({
      error: 'VALIDATION_ERROR',
      message: 'displayName must contain visible text',
      status: 400,
    })
    expect(unsafeQuery).not.toHaveBeenCalled()
  })

  it('returns the standard error envelope for invalid sanitized avatar URLs', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/user/profile',
      payload: { avatarUrl: 'javascript:alert(1)' },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({
      error: 'VALIDATION_ERROR',
      message: 'Invalid avatar URL',
      status: 400,
    })
    expect(unsafeQuery).not.toHaveBeenCalled()
  })

  it('rejects tag-only platform usernames after sanitization', async () => {
    vi.mocked(dbQuery).mockResolvedValueOnce({ rows: [{ count: '0' }] })

    const res = await app.inject({
      method: 'POST',
      url: '/user/platforms',
      payload: {
        platformId: '00000000-0000-0000-0000-000000000000',
        platformUsername: '<b></b>',
      },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({
      error: 'VALIDATION_ERROR',
      message: 'platformUsername must contain visible text',
      status: 400,
    })
  })
})

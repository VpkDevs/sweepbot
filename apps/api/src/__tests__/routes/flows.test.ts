import Fastify from 'fastify'
import { describe, it, expect, beforeEach, vi } from 'vitest'

// mock the database client so we can inspect calls
vi.mock('../../db/client', () => ({
  query: vi.fn(),
  unsafeQuery: vi.fn(),
}))

// mock requireAuth — implementation is (re-)set in beforeEach because
// vitest.config.ts has mockReset: true which clears implementations between tests.
// A reset vi.fn() returns undefined; Fastify hooks that return undefined (not a
// Promise) cause the request to hang, so we always reassign the implementation.
vi.mock('../../middleware/auth', () => ({
  requireAuth: vi.fn(),
}))

import { flowRoutes } from '../../routes/flows'
import { query as dbQuery, unsafeQuery } from '../../db/client'
import { requireAuth } from '../../middleware/auth'

describe('Flow routes (conversation endpoints)', () => {
  let app: ReturnType<typeof Fastify>

  beforeEach(async () => {
    // Re-apply auth mock implementation after mockReset clears it
    vi.mocked(requireAuth).mockImplementation(async (req: any) => {
      req.user = { id: 'user-test-001', email: null, tier: 'free' }
    })

    app = Fastify()
    app.decorateRequest('user', null)
    app.register(flowRoutes, { prefix: '/flows' })
    await app.ready()
  })

  it('starts a new conversation and persists state', async () => {
    ;(unsafeQuery as any).mockResolvedValue({ rows: [] })

    const res = await app.inject({
      method: 'POST',
      url: '/flows/conversations',
      payload: { initialMessage: 'Test flow description' },
    })

    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.data).toHaveProperty('sessionId')
    expect((unsafeQuery as any).mock.calls.length).toBeGreaterThan(0)
  })

  it('returns 404 when continuing unknown conversation', async () => {
    ;(dbQuery as any).mockResolvedValue({ rows: [] })

    const res = await app.inject({
      method: 'POST',
      url: '/flows/converse',
      payload: { conversationId: '00000000-0000-0000-0000-000000000000', userMessage: 'hello' },
    })

    expect(res.statusCode).toBe(404)
    expect(res.json().success).toBe(false)
  })

  it('rejects tag-only flow names after sanitization', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/flows',
      payload: {
        name: '<script></script>',
        description: 'Valid description',
        definition: { type: 'sequence' },
        trigger: { type: 'manual' },
        guardrails: [],
      },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({
      error: 'VALIDATION_ERROR',
      message: 'name and description must contain visible text',
      status: 400,
    })
    expect(unsafeQuery).not.toHaveBeenCalled()
  })
})

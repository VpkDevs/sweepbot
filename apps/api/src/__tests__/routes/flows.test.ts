import Fastify from 'fastify'
import { describe, it, expect, beforeEach, vi } from 'vitest'

// mock the database client so we can inspect calls
vi.mock('../../db/client', () => ({
  query: vi.fn(),
  unsafeQuery: vi.fn(),
}))

import { flowRoutes } from '../../routes/flows'
import { query as dbQuery, unsafeQuery } from '../../db/client'

describe('Flow routes (conversation endpoints)', () => {
  let app: ReturnType<typeof Fastify>

  beforeEach(async () => {
    app = Fastify()
    // simple auth stub that injects a user object
    app.decorateRequest('user', null)
    app.addHook('preValidation', (req, _reply, done) => {
      req.user = { id: 'user-test-001' }
      done()
    })

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
      payload: { conversationId: 'does-not-exist', userMessage: 'hello' },
    })

    expect(res.statusCode).toBe(404)
    expect(res.json().success).toBe(false)
  })
})

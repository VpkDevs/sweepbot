import Fastify from 'fastify'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../db/client', () => ({
  query: vi.fn(),
  unsafeQuery: vi.fn(),
}))

vi.mock('../../middleware/auth', () => ({
  requireAuth: vi.fn(),
}))

import { requireAuth } from '../../middleware/auth'
import { userRoutes } from '../../routes/user'

describe('user routes', () => {
  let app: ReturnType<typeof Fastify>

  beforeEach(async () => {
    vi.mocked(requireAuth).mockImplementation(async (request: any) => {
      request.user = { id: 'user-test-001', email: 'test@example.com', tier: 'free' }
    })

    app = Fastify()
    app.decorateRequest('user', null)
    app.register(userRoutes, { prefix: '/user' })
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
  })

  it('returns the standard validation envelope for invalid avatar URLs', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/user/profile',
      payload: {
        avatarUrl: 'not-a-valid-url',
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({
      error: 'VALIDATION_ERROR',
      message: 'Invalid avatar URL',
      status: 400,
    })
  })
})

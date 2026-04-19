import Fastify from 'fastify'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../db/client', () => ({
  db: {
    execute: vi.fn(),
  },
}))

vi.mock('@sweepbot/utils', () => ({
  logger: {
    error: vi.fn(),
  },
}))

import { db } from '../../db/client'
import { logger } from '@sweepbot/utils'
import auditPlugin from '../../middleware/audit'

describe('audit middleware', () => {
  let app: ReturnType<typeof Fastify>

  beforeEach(async () => {
    vi.mocked(db.execute).mockRejectedValue(new Error('audit insert failed'))

    app = Fastify()
    app.register(auditPlugin)
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
  })

  it('omits query strings from audit actions when no route matches', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/missing?token=secret@example.com',
    })

    expect(response.statusCode).toBe(404)

    await vi.waitFor(() => {
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to log audit event',
        expect.objectContaining({
          action: 'GET /missing',
        })
      )
    })
  })
})

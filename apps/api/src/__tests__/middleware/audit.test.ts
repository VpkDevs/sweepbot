import { describe, expect, it, vi } from 'vitest'
import type { FastifyRequest } from 'fastify'

vi.mock('@sweepbot/utils', () => ({
  logger: {
    error: () => undefined,
  },
}))

import { getRequestPath } from '../../middleware/audit'

describe('audit middleware helpers', () => {
  it('strips query strings when route metadata is unavailable', () => {
    const request = {
      url: '/missing?token=secret@example.com',
      routeOptions: undefined,
    } as unknown as FastifyRequest

    expect(getRequestPath(request)).toBe('/missing')
  })

  it('prefers the normalized route path when Fastify provides one', () => {
    const request = {
      url: '/search?token=secret@example.com',
      routeOptions: { url: '/search' },
    } as unknown as FastifyRequest

    expect(getRequestPath(request)).toBe('/search')
  })
})

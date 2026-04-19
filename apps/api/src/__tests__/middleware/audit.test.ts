import { describe, expect, it } from 'vitest'
import type { FastifyRequest } from 'fastify'
import { getClientIp, getRequestPath, getUserAgent } from '../../middleware/audit'

describe('audit helpers', () => {
  it('strips query strings from fallback request paths', () => {
    const request = {
      routeOptions: undefined,
      url: '/missing?token=secret&email=test@example.com',
    }

    expect(getRequestPath(request as FastifyRequest)).toBe('/missing')
  })

  it('prefers Fastify request.ip instead of x-forwarded-for', () => {
    const request = {
      ip: '203.0.113.9',
      headers: {
        'x-forwarded-for': '198.51.100.4',
      },
    }

    expect(getClientIp(request as FastifyRequest)).toBe('203.0.113.9')
  })

  it('normalizes user-agent headers to a string or null', () => {
    expect(
      getUserAgent({
        headers: { 'user-agent': ['SweepBotTest/1.0', 'ignored'] },
      } as FastifyRequest)
    ).toBe('SweepBotTest/1.0')
    expect(getUserAgent({ headers: {} } as FastifyRequest)).toBeNull()
  })
})

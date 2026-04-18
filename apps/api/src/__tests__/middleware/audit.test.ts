/**
 * Unit tests for the audit logging middleware.
 * Verifies that the audit hook emits records for the correct HTTP verbs
 * and status codes, includes required fields, and omits sensitive data.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import type { FastifyRequest, FastifyReply } from 'fastify'
import { registerAuditHook, registerRequestTimingHook } from '../../middleware/audit'

// Spy on the logger used by the audit middleware
vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

import { logger } from '../../utils/logger'

describe('registerAuditHook', () => {
  let app: ReturnType<typeof Fastify>

  beforeEach(async () => {
    app = Fastify()
    app.decorateRequest('user', null)
    registerRequestTimingHook(app)
    registerAuditHook(app)

    // Minimal route set for testing
    app.get('/health', async (_req: FastifyRequest, _reply: FastifyReply) => ({ ok: true }))
    app.post('/items', async (_req: FastifyRequest, reply: FastifyReply) => reply.code(201).send({ id: '1' }))
    app.patch('/items/1', async (_req: FastifyRequest, reply: FastifyReply) => reply.code(200).send({ id: '1' }))
    app.delete('/items/1', async (_req: FastifyRequest, reply: FastifyReply) => reply.code(204).send())
    app.get('/secret', async (_req: FastifyRequest, reply: FastifyReply) => reply.code(401).send({ error: 'unauth' }))
    app.get('/forbidden', async (_req: FastifyRequest, reply: FastifyReply) => reply.code(403).send({ error: 'forbidden' }))
    app.post('/fail', async (_req: FastifyRequest, reply: FastifyReply) => reply.code(500).send({ error: 'boom' }))

    await app.ready()
  })

  it('does NOT emit an audit record for GET 200', async () => {
    vi.mocked(logger.info).mockClear()
    await app.inject({ method: 'GET', url: '/health' })
    const auditCalls = vi.mocked(logger.info).mock.calls.filter(
      (call) => (call[0] as Record<string, unknown>)['audit'] === true
    )
    expect(auditCalls).toHaveLength(0)
  })

  it('emits an audit record for POST 201', async () => {
    vi.mocked(logger.info).mockClear()
    await app.inject({ method: 'POST', url: '/items', payload: {} })
    const auditCalls = vi.mocked(logger.info).mock.calls.filter(
      (call) => (call[0] as Record<string, unknown>)['audit'] === true
    )
    expect(auditCalls).toHaveLength(1)
    const record = auditCalls[0]![0] as Record<string, unknown>
    expect(record['method']).toBe('POST')
    expect(record['statusCode']).toBe(201)
  })

  it('emits an audit record for PATCH 200', async () => {
    vi.mocked(logger.info).mockClear()
    await app.inject({ method: 'PATCH', url: '/items/1', payload: {} })
    const auditCalls = vi.mocked(logger.info).mock.calls.filter(
      (call) => (call[0] as Record<string, unknown>)['audit'] === true
    )
    expect(auditCalls).toHaveLength(1)
    const record = auditCalls[0]![0] as Record<string, unknown>
    expect(record['method']).toBe('PATCH')
  })

  it('emits an audit record for DELETE 204', async () => {
    vi.mocked(logger.info).mockClear()
    await app.inject({ method: 'DELETE', url: '/items/1' })
    const auditCalls = vi.mocked(logger.info).mock.calls.filter(
      (call) => (call[0] as Record<string, unknown>)['audit'] === true
    )
    expect(auditCalls).toHaveLength(1)
    const record = auditCalls[0]![0] as Record<string, unknown>
    expect(record['method']).toBe('DELETE')
  })

  it('emits an audit record (warn) for GET 401', async () => {
    vi.mocked(logger.warn).mockClear()
    await app.inject({ method: 'GET', url: '/secret' })
    const auditCalls = vi.mocked(logger.warn).mock.calls.filter(
      (call) => (call[0] as Record<string, unknown>)['audit'] === true
    )
    expect(auditCalls).toHaveLength(1)
    const record = auditCalls[0]![0] as Record<string, unknown>
    expect(record['statusCode']).toBe(401)
  })

  it('emits an audit record (warn) for GET 403', async () => {
    vi.mocked(logger.warn).mockClear()
    await app.inject({ method: 'GET', url: '/forbidden' })
    const auditCalls = vi.mocked(logger.warn).mock.calls.filter(
      (call) => (call[0] as Record<string, unknown>)['audit'] === true
    )
    expect(auditCalls).toHaveLength(1)
    const record = auditCalls[0]![0] as Record<string, unknown>
    expect(record['statusCode']).toBe(403)
  })

  it('emits an audit record (error) for POST 500', async () => {
    vi.mocked(logger.error).mockClear()
    await app.inject({ method: 'POST', url: '/fail', payload: {} })
    const auditCalls = vi.mocked(logger.error).mock.calls.filter(
      (call) => (call[0] as Record<string, unknown>)['audit'] === true
    )
    expect(auditCalls).toHaveLength(1)
    const record = auditCalls[0]![0] as Record<string, unknown>
    expect(record['statusCode']).toBe(500)
  })

  it('includes required audit record fields', async () => {
    vi.mocked(logger.info).mockClear()
    await app.inject({ method: 'POST', url: '/items', payload: {} })
    const auditCalls = vi.mocked(logger.info).mock.calls.filter(
      (call) => (call[0] as Record<string, unknown>)['audit'] === true
    )
    const record = auditCalls[0]![0] as Record<string, unknown>
    expect(record).toMatchObject({
      audit: true,
      method: 'POST',
      statusCode: 201,
    })
    expect(typeof record['requestId']).toBe('string')
    expect(typeof record['latencyMs']).toBe('number')
    expect(typeof record['timestamp']).toBe('string')
    // userId should be null when no user is attached
    expect(record['userId']).toBeNull()
  })

  it('includes userId when user is attached to request', async () => {
    const appWithUser = Fastify()
    appWithUser.decorateRequest('user', null)
    registerRequestTimingHook(appWithUser)
    registerAuditHook(appWithUser)
    appWithUser.post('/protected', async (req: FastifyRequest, reply: FastifyReply) => {
      ;(req as FastifyRequest & { user: { id: string; email: string; tier: string } }).user = { id: 'user-123', email: 'a@b.com', tier: 'free' }
      return reply.code(201).send({ ok: true })
    })
    await appWithUser.ready()

    vi.mocked(logger.info).mockClear()
    // We inject AFTER user is set inside handler (simulate post-auth)
    await appWithUser.inject({ method: 'POST', url: '/protected', payload: {} })
    // The audit record captures the userId from request.user set by the handler
    const auditCalls = vi.mocked(logger.info).mock.calls.filter(
      (call) => (call[0] as Record<string, unknown>)['audit'] === true
    )
    expect(auditCalls.length).toBeGreaterThanOrEqual(1)
    const record = auditCalls[0]![0] as Record<string, unknown>
    expect(record['userId']).toBe('user-123')
  })

  it('does not include request body in audit record', async () => {
    vi.mocked(logger.info).mockClear()
    await app.inject({
      method: 'POST',
      url: '/items',
      payload: { password: 'secret123', creditCard: '4242424242424242' },
    })
    const auditCalls = vi.mocked(logger.info).mock.calls.filter(
      (call) => (call[0] as Record<string, unknown>)['audit'] === true
    )
    const record = auditCalls[0]![0] as Record<string, unknown>
    const recordStr = JSON.stringify(record)
    expect(recordStr).not.toContain('secret123')
    expect(recordStr).not.toContain('4242424242424242')
  })

  it('extracts first IP from x-forwarded-for string header', async () => {
    vi.mocked(logger.info).mockClear()
    await app.inject({
      method: 'POST',
      url: '/items',
      payload: {},
      headers: { 'x-forwarded-for': '10.0.0.1, 10.0.0.2, 10.0.0.3' },
    })
    const auditCalls = vi.mocked(logger.info).mock.calls.filter(
      (call) => (call[0] as Record<string, unknown>)['audit'] === true
    )
    const record = auditCalls[0]![0] as Record<string, unknown>
    expect(record['ip']).toBe('10.0.0.1')
  })

  it('extracts first IP from x-forwarded-for array header', async () => {
    vi.mocked(logger.info).mockClear()
    // Fastify allows injecting multiple values for the same header as an array
    await app.inject({
      method: 'POST',
      url: '/items',
      payload: {},
      headers: { 'x-forwarded-for': ['10.1.1.1, 10.1.1.2', '10.1.1.3'] },
    })
    const auditCalls = vi.mocked(logger.info).mock.calls.filter(
      (call) => (call[0] as Record<string, unknown>)['audit'] === true
    )
    const record = auditCalls[0]![0] as Record<string, unknown>
    expect(record['ip']).toBe('10.1.1.1')
  })
})

describe('x-request-id header (buildServer correlation IDs)', () => {
  it('audit records include a requestId field', async () => {
    const app2 = Fastify({ genReqId: () => 'test-req-id-42' })
    app2.decorateRequest('user', null)
    registerRequestTimingHook(app2)
    registerAuditHook(app2)
    app2.post('/x', async (_req: FastifyRequest, reply: FastifyReply) => reply.code(201).send({}))
    await app2.ready()

    vi.mocked(logger.info).mockClear()
    await app2.inject({ method: 'POST', url: '/x', payload: {} })

    const auditCalls = vi.mocked(logger.info).mock.calls.filter(
      (call) => (call[0] as Record<string, unknown>)['audit'] === true
    )
    const record = auditCalls[0]![0] as Record<string, unknown>
    expect(record['requestId']).toBe('test-req-id-42')
  })
})

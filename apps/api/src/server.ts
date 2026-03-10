/**
 * SweepBot API — Server Factory
 *
 * Builds and configures the Fastify server instance with all plugins
 * and routes. Returns the server for use in index.ts or tests.
 */

import Fastify, { type FastifyInstance, type FastifyError } from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import sensible from '@fastify/sensible'
// import websocket from '@fastify/websocket' // TODO: re-enable when Fastify 5 compatible version is released
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'

import { randomUUID } from 'node:crypto'
import { env } from './utils/env.js'
import { logger } from './utils/logger.js'
import { registerRoutes } from './routes/index.js'
import { registerAuditHook, registerRequestTimingHook } from './middleware/audit.js'

export async function buildServer(): Promise<FastifyInstance> {
  const server = Fastify({
    logger: false, // We use our own Pino logger
    // Generate a unique request ID for every request (correlation / audit trail)
    genReqId: () => randomUUID(),
    ajv: {
      customOptions: {
        coerceTypes: 'array',
        removeAdditional: 'all',
        useDefaults: true,
        strict: false,
      },
    },
  })

  // ─── Security ────────────────────────────────────────────────────────────

  await server.register(helmet, {
    contentSecurityPolicy: false,  // Managed at CDN level
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })

  await server.register(cors, {
    origin: env.CORS_ORIGINS.split(',').map((o) => o.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })

  await server.register(rateLimit, {
    global: true,
    max: 200,
    timeWindow: '1 minute',
    redis: undefined, // Will add Redis in Phase 2
    keyGenerator: (request) =>
      request.headers['x-forwarded-for']?.toString() ?? request.ip,
    errorResponseBuilder: (_request, context) => ({
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: `Rate limit exceeded. Try again in ${Math.ceil(context.ttl / 1000)}s.`,
      },
    }),
  })

  // ─── Utilities ───────────────────────────────────────────────────────────

  await server.register(sensible)
  // await server.register(websocket) // TODO: re-enable when Fastify 5 compatible version is released

  // ─── API Documentation (Scalar) ──────────────────────────────────────────

  await server.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'SweepBot API',
        description: 'The SweepBot REST and WebSocket API',
        version: '1.0.0',
        contact: {
          name: 'APPYness',
          email: 'vincekinney1991@gmail.com',
        },
      },
      tags: [
        { name: 'Health', description: 'Health and status endpoints' },
        { name: 'Auth', description: 'Authentication endpoints' },
        { name: 'Platforms', description: 'Platform management' },
        { name: 'Sessions', description: 'Gaming session tracking' },
        { name: 'Analytics', description: 'Analytics and RTP data' },
        { name: 'Jackpots', description: 'Progressive jackpot data' },
        { name: 'Redemptions', description: 'Redemption tracking' },
        { name: 'Trust Index', description: 'Platform trust scores' },
        { name: 'User', description: 'User profile and settings' },
        { name: 'Webhooks', description: 'Stripe and other webhooks' },
      ],
    },
  })

  await server.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
  })

  // ─── Observability ───────────────────────────────────────────────────────

  // Stamp every request with its start time (used by audit latency calculation)
  registerRequestTimingHook(server)

  // Emit structured audit records for all mutating requests and auth failures
  registerAuditHook(server)

  // Echo back the request ID so clients can correlate responses with logs
  server.addHook('onSend', (_request, reply, _payload, done) => {
    reply.header('x-request-id', _request.id)
    done()
  })

  // ─── Routes ──────────────────────────────────────────────────────────────

  await server.register(registerRoutes, { prefix: '/api/v1' })

  // ─── Global Error Handler ────────────────────────────────────────────────

  server.setErrorHandler((error: FastifyError, _request, reply) => {
    logger.error({ err: error }, 'Unhandled error')

    if (error.validation) {
      return reply.code(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: error.validation,
        },
      })
    }

    const statusCode = error.statusCode ?? 500
    return reply.code(statusCode).send({
      success: false,
      error: {
        code: statusCode === 500 ? 'INTERNAL_ERROR' : (error.code ?? 'ERROR'),
        message:
          env.NODE_ENV === 'production' && statusCode === 500
            ? 'Internal server error'
            : error.message,
      },
    })
  })

  // ─── Not Found Handler ───────────────────────────────────────────────────

  server.setNotFoundHandler((_request, reply) => {
    reply.code(404).send({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
      },
    })
  })

  return server
}

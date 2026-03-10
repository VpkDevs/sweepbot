/**
 * Audit Logging Middleware
 *
 * Provides a Fastify `onSend` hook that emits a structured audit record for
 * every mutating request (POST, PUT, PATCH, DELETE) and every authentication
 * failure (401 / 403 on any verb).
 *
 * The audit record intentionally omits request/response bodies to avoid
 * logging PII or secrets.  Structured fields allow downstream log-aggregation
 * tools (Datadog, Loki, etc.) to query by userId, resource, or status code.
 *
 * Record shape:
 * {
 *   audit: true,
 *   requestId: string,
 *   userId: string | null,
 *   method: string,
 *   path: string,
 *   statusCode: number,
 *   ip: string,
 *   userAgent: string | undefined,
 *   latencyMs: number,
 *   timestamp: ISO string,
 * }
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { logger } from '../utils/logger.js'

/** HTTP verbs that change server-side state — always audited. */
const MUTABLE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/** Status codes that represent access-control events — always audited. */
const AUTH_FAILURE_CODES = new Set([401, 403])

/**
 * Register the audit logging `onSend` hook on a Fastify instance.
 *
 * Call this once during server initialisation (in `buildServer()`).
 */
export function registerAuditHook(app: FastifyInstance): void {
  app.addHook(
    'onSend',
    async (
      request: FastifyRequest,
      reply: FastifyReply,
      _payload: unknown
    ): Promise<void> => {
      const statusCode = reply.statusCode
      const method = request.method.toUpperCase()

      const shouldAudit =
        MUTABLE_METHODS.has(method) || AUTH_FAILURE_CODES.has(statusCode)

      if (!shouldAudit) return

      const startTime = (request as FastifyRequest & { startTime?: number }).startTime ?? Date.now()
      const latencyMs = Date.now() - startTime

      const auditRecord = {
        audit: true,
        requestId: request.id as string,
        userId: request.user?.id ?? null,
        method,
        path: request.routeOptions?.url ?? request.url,
        statusCode,
        ip:
          (request.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
          request.ip,
        userAgent: request.headers['user-agent'],
        latencyMs,
        timestamp: new Date().toISOString(),
      }

      if (statusCode >= 500) {
        logger.error(auditRecord, 'audit')
      } else if (statusCode >= 400) {
        logger.warn(auditRecord, 'audit')
      } else {
        logger.info(auditRecord, 'audit')
      }
    }
  )
}

/**
 * Register a lightweight `onRequest` hook that stamps the request start time.
 * This is required so `onSend` can compute accurate latency values.
 */
export function registerRequestTimingHook(app: FastifyInstance): void {
  app.addHook('onRequest', async (request: FastifyRequest): Promise<void> => {
    ;(request as FastifyRequest & { startTime?: number }).startTime = Date.now()
  })
}

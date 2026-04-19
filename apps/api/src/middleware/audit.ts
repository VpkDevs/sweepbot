import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { logger } from '@sweepbot/utils'

/**
 * Audit Logging Middleware
 *
 * Logs all API requests with:
 * - User ID (if authenticated)
 * - HTTP method and path
 * - Client IP address (safely extracted)
 * - Response status code
 * - Timestamp
 *
 * IP address extraction prioritizes safety:
 * 1. Use Fastify's request.ip (validated against trustProxy config)
 * 2. Only trusts x-forwarded-for if behind a configured trusted proxy
 * 3. Falls back to 'unknown' if neither available
 */

/**
 * Safely extracts the client IP address from a request.
 * Respects Fastify's trustProxy configuration to prevent IP spoofing.
 *
 * @param request - Fastify request object
 * @returns Client IP address or 'unknown'
 */
function getClientIp(request: FastifyRequest): string {
  // Fastify parses and validates IP based on trustProxy setting
  // This is the safest way to get the client IP
  if (request.ip) {
    return request.ip
  }

  // Fallback: Try x-forwarded-for, but only if we trust it
  // (This should only happen if trustProxy is misconfigured)
  const forwarded = request.headers['x-forwarded-for']
  if (typeof forwarded === 'string') {
    const ips = forwarded.split(',').map((ip) => ip.trim())
    return ips[0] || 'unknown'
  }

  // If forwarded is array (malformed header), take first element
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return String(forwarded[0])
  }

  return 'unknown'
}

function getRequestPath(request: FastifyRequest): string {
  return request.routeOptions?.url ?? request.url.split('?')[0] ?? request.url
}

interface AuditLogRow {
  user_id: string | null
  action: string
  client_ip: string
  user_agent: string | null
  status_code: number
  timestamp: Date
}

/**
 * Audit logging plugin.
 * Logs all requests to the audit_logs table after response is sent.
 */
const auditPlugin: FastifyPluginAsync = async (app) => {
  // Hook into response phase to log after status is known
  app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const clientIp = getClientIp(request)
      const userId = request.user?.id ?? null
      const action = `${request.method} ${getRequestPath(request)}`
      const userAgent = request.headers['user-agent'] ?? null
      const statusCode = reply.statusCode

      // Log asynchronously to avoid blocking response
      // If logging fails, we don't fail the user's request
      void (async () => {
        try {
          await db.execute<Record<string, unknown>>(sql`
            INSERT INTO audit_logs (user_id, action, client_ip, user_agent, status_code, timestamp)
            VALUES (${userId}, ${action}, ${clientIp}, ${userAgent}, ${statusCode}, NOW())
          `)
        } catch (err) {
          logger.error('Failed to log audit event', {
            error: err instanceof Error ? err.message : String(err),
            userId,
            action,
            clientIp,
          })
          // Don't throw - audit logging should never fail user requests
        }
      })()
    } catch (err) {
      logger.error('Audit middleware error', {
        error: err instanceof Error ? err.message : String(err),
      })
      // Don't throw - middleware should never crash user requests
    }
  })
}

export default auditPlugin

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { logger } from '../utils/logger.js'

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
 * 2. Never trust raw forwarding headers directly inside the middleware
 * 3. Falls back to 'unknown' if neither available
 */

/**
 * Safely extracts the client IP address from a request.
 * Respects Fastify's trustProxy configuration to prevent IP spoofing.
 *
 * @param request - Fastify request object
 * @returns Client IP address or 'unknown'
 */
export function getClientIp(request: FastifyRequest): string {
  return request.ip || 'unknown'
}

export function getRequestPath(request: FastifyRequest): string {
  const routePath = request.routeOptions?.url
  if (routePath) {
    return routePath
  }

  const [path] = request.url.split('?')
  return path ?? request.url
}

export function getUserAgent(request: FastifyRequest): string | null {
  const userAgent = request.headers['user-agent']
  if (typeof userAgent === 'string') {
    return userAgent
  }

  if (Array.isArray(userAgent)) {
    return userAgent[0] ?? null
  }

  return null
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
      const userAgent = getUserAgent(request)
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
          logger.error(
            {
              error: err instanceof Error ? err.message : String(err),
              userId,
              action,
              clientIp,
            },
            'Failed to log audit event'
          )
          // Don't throw - audit logging should never fail user requests
        }
      })()
    } catch (err) {
      logger.error(
        {
          error: err instanceof Error ? err.message : String(err),
        },
        'Audit middleware error'
      )
      // Don't throw - middleware should never crash user requests
    }
  })
}

export default auditPlugin

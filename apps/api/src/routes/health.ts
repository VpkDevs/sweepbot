import type { FastifyInstance } from 'fastify'
import { db } from '../db/client.js'
import { sql } from 'drizzle-orm'

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/health',
    {
      schema: {
        tags: ['Health'],
        summary: 'Health check',
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              timestamp: { type: 'string' },
              version: { type: 'string' },
              services: {
                type: 'object',
                properties: {
                  database: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (_request, _reply) => {
      let dbStatus = 'ok'
      try {
        await db.execute(sql`SELECT 1`)
      } catch {
        dbStatus = 'error'
      }

      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        services: {
          database: dbStatus,
        },
      }
    }
  )

  app.get(
    '/health/ready',
    {
      schema: {
        tags: ['Health'],
        summary: 'Readiness check (used by Railway/k8s)',
      },
    },
    async (_request, reply) => {
      try {
        await db.execute(sql`SELECT 1`)
        return reply.code(200).send({ ready: true })
      } catch {
        return reply.code(503).send({ ready: false })
      }
    }
  )
}

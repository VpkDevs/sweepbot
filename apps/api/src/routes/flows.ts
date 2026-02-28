/**
 * SweepBot Flows API Routes
 * Endpoints for Flow management: creation, execution, scheduling, marketplace
 */

import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { query as dbQuery, unsafeQuery } from '../db/client.js'
import { sql } from 'drizzle-orm'
import { FlowInterpreter, EntityRecognizer, ResponsiblePlayValidator, FlowExecutor } from '@sweepbot/flows'

// Initialize services
const flowInterpreter = new FlowInterpreter()
const flowExecutor = new FlowExecutor()
const rpValidator = new ResponsiblePlayValidator()

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const FlowInterpretRequestSchema = z.object({
  rawInput: z.string().min(10).max(2000),
})

const FlowCreateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string(),
  definition: z.record(z.unknown()),
  trigger: z.record(z.unknown()),
  guardrails: z.array(z.record(z.unknown())),
})

const FlowUpdateSchema = z.object({
  status: z.enum(['draft', 'active', 'paused', 'archived']).optional(),
  name: z.string().max(255).optional(),
  definition: z.record(z.unknown()).optional(),
})

const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

// ============================================================================
// ROUTE HANDLERS
// ============================================================================

export async function flowRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /flows/interpret
   * Convert natural language to Flow definition
   */
  app.post<{ Body: z.infer<typeof FlowInterpretRequestSchema> }>(
    '/interpret',
    {
      schema: {
        tags: ['Flows'],
        summary: 'Interpret natural language into Flow definition',
        body: {
          type: 'object',
          required: ['rawInput'],
          properties: {
            rawInput: { type: 'string', minLength: 10, maxLength: 2000 },
          },
        },
      },
      preValidation: [app._authenticateRequired],
    },
    async (request, reply) => {
      const validated = FlowInterpretRequestSchema.parse(request.body)

      try {
        const result = await flowInterpreter.interpret({
          userId: request.user!.id,
          rawInput: validated.rawInput,
        })

        return reply.send({
          success: true,
          data: result,
        })
      } catch (error) {
        app.log.error('Flow interpretation failed:', error)
        return reply.code(400).send({
          success: false,
          error: {
            code: 'INTERPRETATION_ERROR',
            message: 'Failed to interpret natural language input',
          },
        })
      }
    }
  )

  /**
   * POST /flows/converse
   * Continue multi-turn conversation for Flow building
   */
  app.post<{ Body: { conversationId: string; userMessage: string } }>(
    '/converse',
    {
      schema: {
        tags: ['Flows'],
        summary: 'Continue Flow building conversation',
        body: {
          type: 'object',
          required: ['conversationId', 'userMessage'],
          properties: {
            conversationId: { type: 'string', format: 'uuid' },
            userMessage: { type: 'string', minLength: 1, maxLength: 1000 },
          },
        },
      },
      preValidation: [app._authenticateRequired],
    },
    async (request, reply) => {
      try {
        // Load conversation state from DB
        const { rows } = await dbQuery(
          sql`SELECT * FROM flow_conversations WHERE id = ${request.body.conversationId} AND user_id = ${request.user!.id}`
        )

        if (rows.length === 0) {
          return reply.code(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Conversation not found' },
          })
        }

        // TODO: Implement conversation manager logic
        return reply.send({
          success: true,
          data: rows[0],
        })
      } catch (error) {
        app.log.error('Conversation error:', error)
        return reply.code(500).send({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to continue conversation' },
        })
      }
    }
  )

  /**
   * POST /flows
   * Create a new Flow
   */
  app.post<{ Body: z.infer<typeof FlowCreateSchema> }>(
    '/',
    {
      schema: {
        tags: ['Flows'],
        summary: 'Create a new Flow',
        body: {
          type: 'object',
          required: ['name', 'description', 'definition', 'trigger', 'guardrails'],
        },
      },
      preValidation: [app._authenticateRequired],
    },
    async (request, reply) => {
      try {
        const validated = FlowCreateSchema.parse(request.body)
        const flowId = `flow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

        // Insert flow into database
        const { rows } = await unsafeQuery(
          `INSERT INTO flows (id, user_id, name, description, definition, trigger, status, guardrails)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8::jsonb)
           RETURNING *`,
          [flowId, request.user!.id, validated.name, validated.description,
           JSON.stringify(validated.definition), JSON.stringify(validated.trigger),
           'draft', JSON.stringify(validated.guardrails)]
        )

        return reply.code(201).send({
          success: true,
          data: rows[0],
        })
      } catch (error) {
        app.log.error('Flow creation error:', error)
        return reply.code(400).send({
          success: false,
          error: {
            code: 'CREATION_ERROR',
            message: 'Failed to create Flow',
          },
        })
      }
    }
  )

  /**
   * GET /flows
   * List user's Flows with pagination and filtering
   */
  app.get<{ Querystring: z.infer<typeof PaginationSchema> }>(
    '/',
    {
      schema: {
        tags: ['Flows'],
        summary: 'List user Flows',
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
        },
      },
      preValidation: [app._authenticateRequired],
    },
    async (request, reply) => {
      const validated = PaginationSchema.parse(request.query)
      const offset = (validated.page - 1) * validated.pageSize

      try {
        const { rows: flows } = await dbQuery(
          sql`SELECT * FROM flows WHERE user_id = ${request.user!.id} ORDER BY created_at DESC LIMIT ${validated.pageSize} OFFSET ${offset}`
        )

        const { rows: totalRows } = await dbQuery(
          sql`SELECT COUNT(*) as count FROM flows WHERE user_id = ${request.user!.id}`
        )

        const total = (totalRows[0] as any).count
        const hasMore = offset + validated.pageSize < total

        return reply.send({
          success: true,
          data: flows,
          meta: {
            page: validated.page,
            pageSize: validated.pageSize,
            total,
            hasMore,
          },
        })
      } catch (error) {
        app.log.error('List flows error:', error)
        return reply.code(500).send({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to list Flows' },
        })
      }
    }
  )

  /**
   * GET /flows/:id
   * Get a single Flow by ID
   */
  app.get<{ Params: { id: string } }>(
    '/:id',
    {
      schema: {
        tags: ['Flows'],
        summary: 'Get Flow by ID',
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
      },
      preValidation: [app._authenticateRequired],
    },
    async (request, reply) => {
      try {
        const { rows } = await dbQuery(
          sql`SELECT * FROM flows WHERE id = ${request.params.id} AND user_id = ${request.user!.id}`
        )

        if (rows.length === 0) {
          return reply.code(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Flow not found' },
          })
        }

        return reply.send({
          success: true,
          data: rows[0],
        })
      } catch (error) {
        app.log.error('Get flow error:', error)
        return reply.code(500).send({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to get Flow' },
        })
      }
    }
  )

  /**
   * PATCH /flows/:id
   * Update a Flow
   */
  app.patch<{ Params: { id: string }; Body: z.infer<typeof FlowUpdateSchema> }>(
    '/:id',
    {
      schema: {
        tags: ['Flows'],
        summary: 'Update Flow',
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
      },
      preValidation: [app._authenticateRequired],
    },
    async (request, reply) => {
      const validated = FlowUpdateSchema.parse(request.body)

      try {
        const updates: string[] = ['updated_at = NOW()']
        const values: unknown[] = []
        let idx = 1

        if (validated.status !== undefined) {
          updates.push(`status = $${idx++}`)
          values.push(validated.status)
        }
        if (validated.name !== undefined) {
          updates.push(`name = $${idx++}`)
          values.push(validated.name)
        }
        if (validated.definition !== undefined) {
          updates.push(`definition = $${idx++}::jsonb`)
          values.push(JSON.stringify(validated.definition))
        }

        values.push(request.params.id, request.user!.id)

        const { rows } = await unsafeQuery(
          `UPDATE flows SET ${updates.join(', ')} WHERE id = $${idx + 1} AND user_id = $${idx + 2} RETURNING *`,
          values
        )

        if (rows.length === 0) {
          return reply.code(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Flow not found' },
          })
        }

        return reply.send({
          success: true,
          data: rows[0],
        })
      } catch (error) {
        app.log.error('Flow update error:', error)
        return reply.code(500).send({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to update Flow' },
        })
      }
    }
  )

  /**
   * POST /flows/:id/execute
   * Manually trigger Flow execution
   */
  app.post<{ Params: { id: string } }>(
    '/:id/execute',
    {
      schema: {
        tags: ['Flows'],
        summary: 'Execute Flow manually',
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
      },
      preValidation: [app._authenticateRequired],
    },
    async (request, reply) => {
      try {
        // Load flow
        const { rows } = await dbQuery(
          sql`SELECT * FROM flows WHERE id = ${request.params.id} AND user_id = ${request.user!.id}`
        )

        if (rows.length === 0) {
          return reply.code(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Flow not found' },
          })
        }

        // TODO: Execute flow via FlowExecutor
        return reply.code(202).send({
          success: true,
          data: { message: 'Flow execution started' },
        })
      } catch (error) {
        app.log.error('Flow execution error:', error)
        return reply.code(500).send({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to execute Flow' },
        })
      }
    }
  )

  /**
   * GET /flows/:id/executions
   * Get execution history for a Flow
   */
  app.get<{ Params: { id: string }; Querystring: z.infer<typeof PaginationSchema> }>(
    '/:id/executions',
    {
      schema: {
        tags: ['Flows'],
        summary: 'Get Flow execution history',
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
      },
      preValidation: [app._authenticateRequired],
    },
    async (request, reply) => {
      const validated = PaginationSchema.parse(request.query)
      const offset = (validated.page - 1) * validated.pageSize

      try {
        const { rows: executions } = await dbQuery(
          sql`SELECT * FROM flow_executions WHERE flow_id = ${request.params.id} AND user_id = ${request.user!.id}
              ORDER BY created_at DESC LIMIT ${validated.pageSize} OFFSET ${offset}`
        )

        const { rows: totalRows } = await dbQuery(
          sql`SELECT COUNT(*) as count FROM flow_executions WHERE flow_id = ${request.params.id} AND user_id = ${request.user!.id}`
        )

        const total = (totalRows[0] as any).count

        return reply.send({
          success: true,
          data: executions,
          meta: {
            page: validated.page,
            pageSize: validated.pageSize,
            total,
            hasMore: offset + validated.pageSize < total,
          },
        })
      } catch (error) {
        app.log.error('Get executions error:', error)
        return reply.code(500).send({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to get execution history' },
        })
      }
    }
  )
}

/**
 * SweepBot Flows API Routes
 * Endpoints for Flow management: creation, execution, scheduling, marketplace
 */

import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { query as dbQuery, unsafeQuery } from '../db/client.js'
import { sql } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth.js'
import { randomUUID } from 'node:crypto'
import {
  FlowInterpreter,
  FlowExecutor,
  ResponsiblePlayValidator,
  ConversationManager,
} from '@sweepbot/flows'
import type { ConversationState } from '@sweepbot/flows'

// Initialize services
const flowInterpreter = new FlowInterpreter()
const flowExecutor = new FlowExecutor()
const rpValidator = new ResponsiblePlayValidator()

// Conversation manager with persistence helpers
const conversationManager = new ConversationManager({
  onStateLoad: async (conversationId: string): Promise<ConversationState | null> => {
    const { rows } = await dbQuery<{
      id: string
      user_id: string
      flow_id: string | null
      full_state: string
      turns: string
      status: string
    }>(sql`SELECT * FROM flow_conversations WHERE id = ${conversationId}`)
    if (!rows[0]) return null
    const row = rows[0]
    // If full_state column exists (persisted after #3 fix), deserialise it directly.
    // Fall back to a minimal reconstruction for rows saved by older code.
    if (row.full_state) {
      try {
        return JSON.parse(row.full_state) as ConversationState
      } catch {
        // fall through to legacy reconstruction
      }
    }
    // Legacy fallback: reconstruct minimal state from individual columns
    return {
      sessionId: row.id,
      userId: row.user_id,
      currentFlow: {},
      turns: JSON.parse(row.turns as string) as ConversationState['turns'],
      pendingQuestions: [],
      status: row.status as ConversationState['status'],
    }
  },
  onStateSave: async (state) => {
    await unsafeQuery(
      `
      INSERT INTO flow_conversations
        (id, user_id, flow_id, turns, status, full_state, created_at, updated_at)
      VALUES ($1, $2, $3, $4::jsonb, $5, $6::jsonb, NOW(), NOW())
      ON CONFLICT (id)
      DO UPDATE SET
        turns      = $4::jsonb,
        status     = $5,
        full_state = $6::jsonb,
        updated_at = NOW()
      `,
      [
        state.sessionId,
        state.userId,
        // flowId might be undefined while building
        state.currentFlow && typeof state.currentFlow === 'object' && 'id' in state.currentFlow
          ? (state.currentFlow as { id: string }).id
          : null,
        JSON.stringify(state.turns),
        state.status,
        // Persist the complete state so ConversationManager.continue() can fully reload it
        JSON.stringify(state),
      ]
    )
  },
})

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const FlowInterpretRequestSchema = z.object({
  rawInput: z.string().min(10).max(2000),
})

const FlowCreateSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(255)
    .trim()
    .refine((s) => s.length > 0, 'name cannot be only whitespace'),
  description: z
    .string()
    .min(1)
    .max(1000)
    .trim()
    .refine((s) => s.length > 0, 'description cannot be only whitespace'),
  definition: z
    .record(z.unknown())
    .refine((obj) => Object.keys(obj).length > 0, 'definition cannot be empty'),
  trigger: z
    .record(z.unknown())
    .refine((obj) => Object.keys(obj).length > 0, 'trigger cannot be empty'),
  guardrails: z.array(z.record(z.unknown())).min(0).max(10),
})

const FlowUpdateSchema = z.object({
  status: z.enum(['draft', 'active', 'paused', 'archived']).optional(),
  name: z
    .string()
    .min(1)
    .max(255)
    .trim()
    .refine((s) => s.length > 0, 'name cannot be only whitespace')
    .optional(),
  definition: z
    .record(z.unknown())
    .refine((obj) => Object.keys(obj).length > 0, 'definition cannot be empty')
    .optional(),
})

const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

const ConversationStartSchema = z.object({
  initialMessage: z
    .string()
    .min(1, 'initialMessage is required')
    .max(2000, 'initialMessage must be ≤ 2000 characters')
    .trim(),
})

const ConversationContinueSchema = z.object({
  conversationId: z.string().uuid('conversationId must be a valid UUID'),
  userMessage: z
    .string()
    .min(1, 'userMessage is required')
    .max(1000, 'userMessage must be ≤ 1000 characters')
    .trim(),
})

// ============================================================================
// ROUTE HANDLERS
/**
 * Registers the Flows API routes onto a Fastify instance.
 *
 * Registers authenticated endpoints under /flows for interpreting natural language into flows,
 * creating, listing, retrieving, updating, executing, viewing executions, conversing, and deleting flows.
 *
 * @param app - Fastify instance to which the routes will be attached; a preValidation authentication
 *   hook is applied to all registered routes.
 */

export async function flowRoutes(app: FastifyInstance): Promise<void> {
  // ── Auth guard on all routes ─────────────────────────────────────────────────
  app.addHook('preValidation', requireAuth)

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
        app.log.error({ error }, 'Flow interpretation failed')
        return reply.code(400).send({
          error: 'INTERPRETATION_ERROR',
          message: 'Failed to interpret natural language input',
          status: 400,
        })
      }
    }
  )

  /**
   * POST /flows/converse
   * Continue multi-turn conversation for Flow building
   */
  // ─────────────────────────────────────────────────────────────────────────
  // Conversation (multi-turn) helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * POST /flows/conversations
   * Start a new multi‑turn conversation for building a Flow.
   */
  app.post<{ Body: z.infer<typeof ConversationStartSchema> }>(
    '/conversations',
    {
      schema: {
        tags: ['Flows'],
        summary: 'Start a new flow‑building conversation',
        body: {
          type: 'object',
          required: ['initialMessage'],
          properties: {
            initialMessage: { type: 'string', minLength: 1, maxLength: 2000 },
          },
        },
      },
    },
    async (request, reply) => {
      let validated: z.infer<typeof ConversationStartSchema>
      try {
        validated = ConversationStartSchema.parse(request.body)
      } catch (err) {
        return reply
          .code(400)
          .send({ error: 'VALIDATION_ERROR', message: 'initialMessage is required', status: 400 })
      }
      const { initialMessage } = validated
      const conversationId = randomUUID()
      try {
        const state = await conversationManager.startConversation(
          request.user!.id,
          conversationId,
          initialMessage
        )
        return reply.code(201).send({ success: true, data: state })
      } catch (error) {
        app.log.error({ error }, 'Failed to start conversation')
        return reply
          .code(500)
          .send({ error: 'INTERNAL_ERROR', message: 'Could not start conversation', status: 500 })
      }
    }
  )

  /**
   * POST /flows/converse
   * Continue multi-turn conversation for Flow building
   */
  app.post<{ Body: z.infer<typeof ConversationContinueSchema> }>(
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
    },
    async (request, reply) => {
      let validated: z.infer<typeof ConversationContinueSchema>
      try {
        validated = ConversationContinueSchema.parse(request.body)
      } catch (err) {
        return reply.code(400).send({
          error: 'VALIDATION_ERROR',
          message: 'conversationId and userMessage are required',
          status: 400,
        })
      }
      try {
        // Ensure the conversation belongs to the authenticated user
        const { rows } = await dbQuery(
          sql`SELECT id FROM flow_conversations WHERE id = ${validated.conversationId} AND user_id = ${request.user!.id}`
        )

        if (rows.length === 0) {
          return reply.code(404).send({
            success: false,
            error: 'NOT_FOUND',
            message: 'Conversation not found',
            status: 404,
          })
        }

        // Delegate business logic to ConversationManager which will
        // load and save state via the hooks we configured above.
        const updatedState = await conversationManager.continue(
          validated.conversationId,
          validated.userMessage
        )

        return reply.send({ success: true, data: updatedState })
      } catch (error) {
        app.log.error({ error }, 'Conversation error')
        return reply.code(500).send({
          error: 'INTERNAL_ERROR',
          message: 'Failed to continue conversation',
          status: 500,
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
    },
    async (request, reply) => {
      try {
        const validated = FlowCreateSchema.parse(request.body)
        const flowId = crypto.randomUUID()

        // Insert flow into database
        const { rows } = await unsafeQuery(
          `INSERT INTO flows (id, user_id, name, description, definition, trigger, status, guardrails)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8::jsonb)
           RETURNING *`,
          [
            flowId,
            request.user!.id,
            validated.name,
            validated.description,
            JSON.stringify(validated.definition),
            JSON.stringify(validated.trigger),
            'draft',
            JSON.stringify(validated.guardrails),
          ]
        )

        return reply.code(201).send({
          success: true,
          data: rows[0],
        })
      } catch (error) {
        app.log.error({ error }, 'Flow creation error')
        return reply
          .code(400)
          .send({ error: 'CREATION_ERROR', message: 'Failed to create Flow', status: 400 })
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

        const total = (totalRows[0] as { count: number }).count
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
        app.log.error({ error }, 'List flows error')
        return reply
          .code(500)
          .send({ error: 'INTERNAL_ERROR', message: 'Failed to list Flows', status: 500 })
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
    },
    async (request, reply) => {
      try {
        const { rows } = await dbQuery(
          sql`SELECT * FROM flows WHERE id = ${request.params.id} AND user_id = ${request.user!.id}`
        )

        if (rows.length === 0) {
          return reply
            .code(404)
            .send({ error: 'NOT_FOUND', message: 'Flow not found', status: 404 })
        }

        return reply.send({
          success: true,
          data: rows[0],
        })
      } catch (error) {
        app.log.error({ error }, 'Get flow error')
        return reply
          .code(500)
          .send({ error: 'INTERNAL_ERROR', message: 'Failed to get Flow', status: 500 })
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
          `UPDATE flows SET ${updates.join(', ')} WHERE id = $${idx} AND user_id = $${idx + 1} RETURNING *`,
          values
        )

        if (rows.length === 0) {
          return reply
            .code(404)
            .send({ error: 'NOT_FOUND', message: 'Flow not found', status: 404 })
        }

        return reply.send({
          success: true,
          data: rows[0],
        })
      } catch (error) {
        app.log.error({ error }, 'Flow update error')
        return reply
          .code(500)
          .send({ error: 'INTERNAL_ERROR', message: 'Failed to update Flow', status: 500 })
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
    },
    async (request, reply) => {
      try {
        const userId = request.user!.id
        const flowId = request.params.id

        // Load flow
        const { rows: flowRows } = await dbQuery(
          sql`SELECT * FROM flows WHERE id = ${flowId} AND user_id = ${userId}`
        )

        if (flowRows.length === 0) {
          return reply
            .code(404)
            .send({ error: 'NOT_FOUND', message: 'Flow not found', status: 404 })
        }

        const flow = flowRows[0] as { definition: unknown; [key: string]: unknown }

        // Create execution record
        const { rows: execRows } = await dbQuery(
          sql`INSERT INTO flow_executions (flow_id, user_id, status, started_at, metrics, log)
              VALUES (${flowId}, ${userId}, 'running', NOW(), '{}', '[]')
              RETURNING id, created_at`
        )

        const executionId = (execRows[0] as { id: string }).id

        // Execute flow asynchronously (non-blocking)
        flowExecutor
          .execute(flow.definition as Parameters<typeof flowExecutor.execute>[0], userId)
          .then(() => {
            // Mark as completed (background)
            return dbQuery(
              sql`UPDATE flow_executions SET status = 'completed' WHERE id = ${executionId}`
            )
          })
          .catch((error) => {
            app.log.error({ error }, 'Flow execution failed')
            // Mark as failed (background)
            dbQuery(
              sql`UPDATE flow_executions SET status = 'failed', error_message = ${String(error)} WHERE id = ${executionId}`
            ).catch((dbErr) => {
              app.log.error({ dbErr }, 'Failed to mark execution as failed')
            })
          })

        return reply.code(202).send({
          success: true,
          data: { executionId, status: 'running' },
        })
      } catch (error) {
        app.log.error({ error }, 'Flow execution error')
        return reply
          .code(500)
          .send({ error: 'INTERNAL_ERROR', message: 'Failed to execute Flow', status: 500 })
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

        const total = (totalRows[0] as { count: number }).count

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
        app.log.error({ error }, 'Get executions error')
        return reply.code(500).send({
          error: 'INTERNAL_ERROR',
          message: 'Failed to get execution history',
          status: 500,
        })
      }
    }
  )

  /**
   * DELETE /flows/:id
   * Delete a Flow
   */
  app.delete<{ Params: { id: string } }>(
    '/:id',
    {
      schema: {
        tags: ['Flows'],
        summary: 'Delete Flow by ID',
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
      },
    },
    async (request, reply) => {
      try {
        const { rows } = await dbQuery(
          sql`DELETE FROM flows WHERE id = ${request.params.id} AND user_id = ${request.user!.id} RETURNING id`
        )

        if (rows.length === 0) {
          return reply
            .code(404)
            .send({ error: 'NOT_FOUND', message: 'Flow not found', status: 404 })
        }

        return reply.send({
          success: true,
          data: { deleted: true },
        })
      } catch (error) {
        app.log.error({ error }, 'Delete flow error')
        return reply
          .code(500)
          .send({ error: 'INTERNAL_ERROR', message: 'Failed to delete Flow', status: 500 })
      }
    }
  )

  /**
   * GET /flows/:id/execution/current
   * Get the most recent flow execution
   */
  app.get<{ Params: { id: string } }>(
    '/:id/execution/current',
    {
      schema: {
        tags: ['Flows'],
        summary: 'Get current/most recent flow execution',
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
      },
    },
    async (request, reply) => {
      try {
        const { rows } = await dbQuery(
          sql`SELECT * FROM flow_executions WHERE flow_id = ${request.params.id} AND user_id = ${request.user!.id} ORDER BY started_at DESC LIMIT 1`
        )

        return reply.send({
          success: true,
          data: rows[0] ?? null,
        })
      } catch (error) {
        app.log.error({ error }, 'Get current execution error')
        return reply.code(500).send({
          error: 'INTERNAL_ERROR',
          message: 'Failed to get current execution',
          status: 500,
        })
      }
    }
  )

  /**
   * POST /flows/:id/execution/cancel
   * Cancel a running flow execution
   */
  app.post<{ Params: { id: string } }>(
    '/:id/execution/cancel',
    {
      schema: {
        tags: ['Flows'],
        summary: 'Cancel a running flow execution',
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
      },
    },
    async (request, reply) => {
      try {
        const { rows } = await dbQuery(
          sql`UPDATE flow_executions SET status = 'stopped_by_user', completed_at = NOW() WHERE flow_id = ${request.params.id} AND status = 'running' AND user_id = ${request.user!.id} RETURNING id`
        )

        if (rows.length === 0) {
          return reply
            .code(404)
            .send({ error: 'NOT_FOUND', message: 'No running execution found', status: 404 })
        }

        return reply.send({
          success: true,
          data: { id: rows[0]!['id'] },
        })
      } catch (error) {
        app.log.error({ error }, 'Cancel execution error')
        return reply
          .code(500)
          .send({ error: 'INTERNAL_ERROR', message: 'Failed to cancel execution', status: 500 })
      }
    }
  )
}

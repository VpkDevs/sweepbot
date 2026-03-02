/**
 * SweepBot Flows - Natural Language Automation Engine Types
 * Core type definitions for the Flow AST, execution, and interpretation
 */
import { z } from 'zod';
// ============================================================================
// ZOD VALIDATION SCHEMAS
// ============================================================================
export const FlowTriggerSchema = z.union([
    z.object({ type: z.literal('scheduled'), cron: z.string(), timezone: z.string() }),
    z.object({ type: z.literal('manual') }),
    z.object({ type: z.literal('event'), event: z.string() }),
    z.object({ type: z.literal('condition'), condition: z.string() }),
]);
export const FlowValueSchema = z.union([
    z.object({ type: z.literal('literal'), value: z.union([z.number(), z.string(), z.boolean()]) }),
    z.object({ type: z.literal('variable'), name: z.string() }),
    z.object({ type: z.literal('expression'), expression: z.string() }),
    z.object({ type: z.literal('query'), query: z.string() }),
]);
export const ResponsiblePlayGuardrailSchema = z.object({
    type: z.enum([
        'max_duration',
        'max_loss',
        'balance_floor',
        'max_iterations',
        'chase_detection',
        'cool_down_check',
        'daily_aggregate',
    ]),
    value: z.union([z.number(), z.boolean()]),
    source: z.enum(['user_specified', 'system_default', 'system_mandatory']),
    overridable: z.boolean(),
});
export const FlowInterpretationRequestSchema = z.object({
    userId: z.string().uuid(),
    rawInput: z.string().min(10).max(2000),
    conversationHistory: z.array(z.object({ role: z.string(), content: z.string() })).optional(),
    existingFlows: z.array(z.any()).optional(),
});
//# sourceMappingURL=types.js.map
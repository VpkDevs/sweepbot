/**
 * SweepBot Flows - Natural Language Automation Engine Types
 * Core type definitions for the Flow AST, execution, and interpretation
 */

import { z } from 'zod'

// ============================================================================
// CORE FLOW DEFINITION TYPES
// ============================================================================

export interface FlowDefinition {
  id: string
  userId: string
  name: string
  description: string // original natural language input
  version: number
  status: 'draft' | 'active' | 'paused' | 'archived'
  trigger: FlowTrigger
  rootNode: FlowNode
  variables: FlowVariable[]
  responsiblePlayGuardrails: ResponsiblePlayGuardrail[]
  createdAt: Date
  updatedAt: Date
  lastExecutedAt?: Date
  executionCount: number
  performanceStats: FlowPerformanceStats
}

// Trigger types - when does the flow execute?
export type FlowTrigger =
  | { type: 'scheduled'; cron: string; timezone: string }
  | { type: 'manual' }
  | { type: 'event'; event: FlowEventType }
  | { type: 'condition'; condition: string }

export type FlowEventType = 'new_bonus_available' | 'jackpot_threshold_reached' | 'balance_updated'

// ============================================================================
// FLOW NODE TYPES - AST nodes representing actions, conditions, loops, etc.
// ============================================================================

export type FlowNode =
  | FlowActionNode
  | FlowConditionNode
  | FlowLoopNode
  | FlowSequenceNode
  | FlowParallelNode
  | FlowWaitNode
  | FlowStopNode
  | FlowAlertNode
  | FlowStoreNode

export interface FlowActionNode {
  type: 'action'
  id: string
  action: FlowActionType
  platform?: string // 'chumba', 'luckyland', etc.
  game?: string // game name or slug
  parameters: Record<string, unknown>
  timeout: number // milliseconds
  onFailure: 'skip' | 'retry' | 'stop' | FlowNode // what to do if action fails
  next?: FlowNode // next node to execute after success
}

export type FlowActionType =
  | 'open_platform'
  | 'login'
  | 'logout'
  | 'claim_bonus'
  | 'open_game'
  | 'spin'
  | 'bet'
  | 'check_balance'
  | 'cash_out'
  | 'close_platform'
  | 'wait_for_notification'

export interface FlowConditionNode {
  type: 'condition'
  id: string
  left: FlowValue // what we're comparing
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=' | 'contains' | 'exists'
  right: FlowValue // what we're comparing against
  onTrue: FlowNode // execute if condition is true
  onFalse?: FlowNode // execute if condition is false
}

export interface FlowLoopNode {
  type: 'loop'
  id: string
  condition: FlowConditionNode // condition to check each iteration
  body: FlowNode // node(s) to execute in loop
  maxIterations: number // safety cap - never execute more than this
  maxDuration: number // safety cap in milliseconds - never run longer than this
}

export interface FlowSequenceNode {
  type: 'sequence'
  id: string
  steps: FlowNode[] // execute these nodes in order
}

export interface FlowParallelNode {
  type: 'parallel'
  id: string
  branches: FlowNode[] // execute these nodes in parallel
  waitFor: 'all' | 'any' | 'none' // wait for all to complete, any to complete, or don't wait
}

export interface FlowWaitNode {
  type: 'wait'
  id: string
  duration: number // milliseconds to wait
  next?: FlowNode
}

export interface FlowStopNode {
  type: 'stop'
  id: string
  reason?: string
}

export interface FlowAlertNode {
  type: 'alert'
  id: string
  message: string
  alertType: 'info' | 'warning' | 'error'
  next?: FlowNode
}

export interface FlowStoreNode {
  type: 'store'
  id: string
  variable: string // variable name to store in
  value: FlowValue // value to store
  next?: FlowNode
}

// ============================================================================
// FLOW VALUES - What can be evaluated to a value?
// ============================================================================

export type FlowValue =
  | { type: 'literal'; value: number | string | boolean }
  | { type: 'variable'; name: string } // $BONUS, $BALANCE, etc.
  | { type: 'expression'; expression: string } // "($BONUS * 5)"
  | { type: 'query'; query: string } // "my_balance_on_chumba"

// ============================================================================
// VARIABLES - Named storage for flow data
// ============================================================================

export interface FlowVariable {
  name: string
  type: 'number' | 'string' | 'boolean' | 'platform' | 'game'
  value?: unknown
  source?: 'user_input' | 'action_result' | 'system_query' | 'literal'
}

// ============================================================================
// RESPONSIBLE PLAY GUARDRAILS - Non-negotiable safety constraints
// ============================================================================

export interface ResponsiblePlayGuardrail {
  type:
    | 'max_duration'
    | 'max_loss'
    | 'balance_floor'
    | 'max_iterations'
    | 'chase_detection'
    | 'cool_down_check'
    | 'daily_aggregate'
  value: number | boolean
  source: 'user_specified' | 'system_default' | 'system_mandatory'
  overridable: boolean // system_mandatory guardrails are NEVER overridable
}

// ============================================================================
// EXECUTION CONTEXT AND METRICS
// ============================================================================

export interface FlowExecutionContext {
  flowId: string
  executionId: string
  userId: string
  variables: Map<string, unknown>
  startedAt: Date
  currentNode: string // ID of currently executing node
  status: 'running' | 'paused' | 'completed' | 'failed' | 'stopped_by_guardrail'
  log: FlowExecutionLog[]
  metrics: FlowExecutionMetrics
}

export interface FlowExecutionMetrics {
  totalDuration: number // milliseconds
  actionsExecuted: number
  conditionsEvaluated: number
  loopIterations: number
  platformsAccessed: string[]
  bonusesClaimed: number
  bonusValueClaimed: number
  spinsExecuted: number
  totalWagered: number
  totalWon: number
  netResult: number
  guardrailsTriggered: string[]
}

export interface FlowExecutionLog {
  timestamp: Date
  nodeId: string
  type:
    | 'action_start'
    | 'action_complete'
    | 'action_failed'
    | 'condition_evaluated'
    | 'loop_iteration'
    | 'variable_set'
    | 'guardrail_triggered'
    | 'user_alert'
    | 'error'
  details: Record<string, unknown>
}

export interface FlowPerformanceStats {
  totalExecutions?: number
  successfulExecutions?: number
  failedExecutions?: number
  averageDuration?: number // milliseconds
  averageNetResult?: number
  lastExecutedAt?: Date
}

// ============================================================================
// NLP INTERPRETATION TYPES
// ============================================================================

export interface FlowInterpretationRequest {
  userId: string
  rawInput: string
  conversationHistory?: ConversationMessage[]
  existingFlows?: FlowDefinition[]
}

export interface FlowInterpretationResult {
  flow: FlowDefinition
  confidence: number // 0-1, how confident we are
  humanReadableSummary: string // plain English confirmation
  ambiguities?: Ambiguity[]
  warnings?: FlowWarning[]
  suggestedImprovements?: string[]
}

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export interface Ambiguity {
  field: string
  possibleValues: string[]
  userInput: string
  question: string
}

export interface FlowWarning {
  type: 'responsible_play' | 'platform_limitation' | 'logic_error' | 'performance'
  severity: 'info' | 'warning' | 'error'
  message: string
  suggestion?: string
}

// ============================================================================
// ENTITY RECOGNITION TYPES - NLP entity extraction
// ============================================================================

export interface EntityMap {
  platforms: PlatformEntity[]
  games: GameEntity[]
  actions: ActionEntity[]
  conditions: ConditionEntity[]
  schedules: ScheduleEntity[]
  amounts: AmountEntity[]
  durations: DurationEntity[]
  variables: VariableEntity[]
}

export interface PlatformEntity {
  name: string
  normalized: string // 'chumba', 'luckyland', 'stake', etc.
  confidence: number // 0-1
  aliases: string[] // ['CC', 'Chumba Casino']
}

export interface GameEntity {
  name: string
  normalized: string // game slug
  confidence: number
  provider?: string
}

export interface ActionEntity {
  text: string
  type: FlowActionType
  parameters?: Record<string, unknown>
}

export interface ConditionEntity {
  text: string
  type: 'comparison' | 'boolean' | 'expression'
  left?: string
  operator?: string
  right?: string
}

export interface ScheduleEntity {
  text: string
  cron: string // "0 15 * * *" for 3:30 PM daily
  timezone: string
  frequency: 'once' | 'daily' | 'weekly' | 'monthly' | 'custom'
}

export interface AmountEntity {
  text: string
  type: 'absolute' | 'relative'
  value?: number
  reference?: string // 'the_bonus', 'my_balance', 'my_deposit'
  multiplier?: number // for "5x the bonus"
}

export interface DurationEntity {
  text: string
  type: 'time' | 'iteration'
  value: number
  unit: 'minutes' | 'hours' | 'spins' | 'sessions'
}

export interface VariableEntity {
  name: string
  source: 'action_result' | 'user_input' | 'system_query'
  type: 'number' | 'string' | 'boolean'
}

// ============================================================================
// CONVERSATION TYPES
// ============================================================================

export interface ConversationState {
  userId: string
  sessionId: string
  currentFlow: Partial<FlowDefinition>
  turns: ConversationTurn[]
  pendingQuestions: string[]
  status: 'building' | 'confirming' | 'modifying' | 'complete'
}

export interface ConversationTurn {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  flowState?: Partial<FlowDefinition>
}

// ============================================================================
// FLOW MARKETPLACE TYPES
// ============================================================================

export interface SharedFlow {
  id: string
  creatorId: string
  title: string
  description: string
  category: FlowCategory
  tags: string[]
  flowTemplate: FlowDefinition
  pricing: 'free' | { amount: number; currency: 'USD' }
  stats: {
    imports: number
    activeUsers: number
    averageNetResult: number
    averageTimeSavedMinutes: number
    rating: number
    reviews: number
  }
  verifiedPerformance: boolean
  createdAt: Date
  updatedAt: Date
}

export type FlowCategory =
  | 'bonus_collection'
  | 'play_strategy'
  | 'redemption_optimization'
  | 'multi_platform_routine'
  | 'jackpot_hunting'
  | 'bankroll_management'
  | 'responsible_play'

// ============================================================================
// ZOD VALIDATION SCHEMAS
// ============================================================================

export const FlowTriggerSchema = z.union([
  z.object({ type: z.literal('scheduled'), cron: z.string(), timezone: z.string() }),
  z.object({ type: z.literal('manual') }),
  z.object({ type: z.literal('event'), event: z.string() }),
  z.object({ type: z.literal('condition'), condition: z.string() }),
])

export const FlowValueSchema: z.ZodType<FlowValue> = z.union([
  z.object({ type: z.literal('literal'), value: z.union([z.number(), z.string(), z.boolean()]) }),
  z.object({ type: z.literal('variable'), name: z.string() }),
  z.object({ type: z.literal('expression'), expression: z.string() }),
  z.object({ type: z.literal('query'), query: z.string() }),
])

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
})

export const FlowInterpretationRequestSchema = z.object({
  userId: z.string().uuid(),
  rawInput: z.string().min(10).max(2000),
  conversationHistory: z.array(z.object({ role: z.string(), content: z.string() })).optional(),
  existingFlows: z.array(z.any()).optional(),
})

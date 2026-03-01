/**
 * Browser-safe Flow types for the SweepBot extension.
 * Adapted from @sweepbot/flows — no Node.js dependencies.
 */

// ─── Trigger ─────────────────────────────────────────────────────────────────

export type FlowTrigger =
  | { type: 'manual' }
  | { type: 'scheduled'; cron: string; timezone: string; humanReadable: string }

// ─── Value references used in conditions ─────────────────────────────────────

export type ValueRef =
  | { kind: 'variable'; name: string }
  | { kind: 'literal'; value: number | string | boolean }
  | { kind: 'multiply'; ref: ValueRef; factor: number }

// ─── Condition ────────────────────────────────────────────────────────────────

export interface Condition {
  left: ValueRef
  operator: '>' | '<' | '>=' | '<=' | '==' | '!='
  right: ValueRef
}

// ─── Steps ────────────────────────────────────────────────────────────────────

export type FlowStep =
  | NavigateStep
  | ClickStep
  | WaitStep
  | WaitForStep
  | ReadValueStep
  | LoopStep
  | IfStep
  | NotifyStep
  | StopStep
  | LoginStep
  | ClaimBonusStep
  | OpenGameStep
  | SpinStep
  | StoreVariableStep

export interface NavigateStep {
  type: 'navigate'
  url: string
  waitForLoad?: boolean
}

export interface ClickStep {
  type: 'click'
  /** Primary CSS selector */
  selector?: string
  /** Fallback: find element containing this text */
  text?: string
  /** Fallback: ARIA label */
  ariaLabel?: string
  timeout: number
  description: string
}

export interface WaitStep {
  type: 'wait'
  ms: number
  reason?: string
}

export interface WaitForStep {
  type: 'wait_for'
  selector: string
  timeout: number
  description?: string
}

export interface ReadValueStep {
  type: 'read_value'
  /** Variable name to store the result */
  variable: string
  selector: string
  /** How to extract value: 'text' | 'innerText' | 'value' | 'data-amount' */
  attribute: string
  /** Optional: parse as number */
  parseAs?: 'number' | 'string'
  timeout: number
}

export interface LoopStep {
  type: 'loop'
  condition: Condition
  body: FlowStep[]
  maxIterations: number
  maxDurationMs: number
}

export interface IfStep {
  type: 'if'
  condition: Condition
  then: FlowStep[]
  else?: FlowStep[]
}

export interface NotifyStep {
  type: 'notify'
  title: string
  message: string
}

export interface StopStep {
  type: 'stop'
  reason: string
}

export interface LoginStep {
  type: 'login'
  platform: string
  /** If true, uses stored credentials from extension storage */
  useStoredCredentials: boolean
}

export interface ClaimBonusStep {
  type: 'claim_bonus'
  platform: string
  /** Variable to store the bonus amount in */
  storeAmountAs?: string
}

export interface OpenGameStep {
  type: 'open_game'
  platform: string
  game: string
}

export interface SpinStep {
  type: 'spin'
  /** Variable to store win amount in */
  storeWinAs?: string
  /** Bet amount — undefined means use current bet */
  betAmount?: number
}

export interface StoreVariableStep {
  type: 'store_variable'
  name: string
  value: ValueRef
}

// ─── Responsible Play Limits ─────────────────────────────────────────────────

export interface ResponsibleLimits {
  /** Hard cap on loop iterations, even if condition passes */
  maxSpins: number
  /** Total session duration cap in ms */
  maxDurationMs: number
}

// ─── Flow Definition ──────────────────────────────────────────────────────────

export type FlowStatus = 'draft' | 'active' | 'paused' | 'archived'

export interface FlowDefinition {
  id: string
  name: string
  /** Original natural-language description from user */
  description: string
  status: FlowStatus
  trigger: FlowTrigger
  steps: FlowStep[]
  limits: ResponsibleLimits
  /** Confidence 0-1 from NLP interpretation */
  confidence: number
  /** Human-readable summary of what the flow will do */
  humanSummary: string
  createdAt: number
  updatedAt: number
  lastExecutedAt?: number
  executionCount: number
}

// ─── Execution ────────────────────────────────────────────────────────────────

export type FlowExecutionStatus =
  | 'running'
  | 'completed'
  | 'stopped'
  | 'failed'
  | 'limit_reached'

export interface FlowExecution {
  id: string
  flowId: string
  startedAt: number
  endedAt?: number
  status: FlowExecutionStatus
  stepResults: StepResult[]
  variables: Record<string, unknown>
  error?: string
}

export interface StepResult {
  stepType: string
  description: string
  success: boolean
  durationMs: number
  value?: unknown
  error?: string
}

// ─── Interpretation Result ────────────────────────────────────────────────────

export interface InterpretationResult {
  flow: FlowDefinition
  confidence: number
  humanSummary: string
  warnings: string[]
  ambiguities: string[]
}

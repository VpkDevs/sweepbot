/**
 * SweepBot Flows - Natural Language Automation Engine Types
 * Core type definitions for the Flow AST, execution, and interpretation
 */
import { z } from 'zod';
export interface FlowDefinition {
    id: string;
    userId: string;
    name: string;
    description: string;
    version: number;
    status: 'draft' | 'active' | 'paused' | 'archived';
    trigger: FlowTrigger;
    rootNode: FlowNode;
    variables: FlowVariable[];
    responsiblePlayGuardrails: ResponsiblePlayGuardrail[];
    createdAt: Date;
    updatedAt: Date;
    lastExecutedAt?: Date;
    executionCount: number;
    performanceStats: FlowPerformanceStats;
}
export type FlowTrigger = {
    type: 'scheduled';
    cron: string;
    timezone: string;
} | {
    type: 'manual';
} | {
    type: 'event';
    event: FlowEventType;
} | {
    type: 'condition';
    condition: string;
};
export type FlowEventType = 'new_bonus_available' | 'jackpot_threshold_reached' | 'balance_updated';
export type FlowNode = FlowActionNode | FlowConditionNode | FlowLoopNode | FlowSequenceNode | FlowParallelNode | FlowWaitNode | FlowStopNode | FlowAlertNode | FlowStoreNode;
export interface FlowActionNode {
    type: 'action';
    id: string;
    action: FlowActionType;
    platform?: string;
    game?: string;
    parameters: Record<string, unknown>;
    timeout: number;
    onFailure: 'skip' | 'retry' | 'stop' | FlowNode;
    next?: FlowNode;
}
export type FlowActionType = 'open_platform' | 'login' | 'logout' | 'claim_bonus' | 'open_game' | 'spin' | 'bet' | 'check_balance' | 'cash_out' | 'close_platform' | 'wait_for_notification';
export interface FlowConditionNode {
    type: 'condition';
    id: string;
    left: FlowValue;
    operator: '>' | '<' | '>=' | '<=' | '==' | '!=' | 'contains' | 'exists';
    right: FlowValue;
    onTrue: FlowNode;
    onFalse?: FlowNode;
}
export interface FlowLoopNode {
    type: 'loop';
    id: string;
    condition: FlowConditionNode;
    body: FlowNode;
    maxIterations: number;
    maxDuration: number;
}
export interface FlowSequenceNode {
    type: 'sequence';
    id: string;
    steps: FlowNode[];
}
export interface FlowParallelNode {
    type: 'parallel';
    id: string;
    branches: FlowNode[];
    waitFor: 'all' | 'any' | 'none';
}
export interface FlowWaitNode {
    type: 'wait';
    id: string;
    duration: number;
    next?: FlowNode;
}
export interface FlowStopNode {
    type: 'stop';
    id: string;
    reason?: string;
}
export interface FlowAlertNode {
    type: 'alert';
    id: string;
    message: string;
    alertType: 'info' | 'warning' | 'error';
    next?: FlowNode;
}
export interface FlowStoreNode {
    type: 'store';
    id: string;
    variable: string;
    value: FlowValue;
    next?: FlowNode;
}
export type FlowValue = {
    type: 'literal';
    value: number | string | boolean;
} | {
    type: 'variable';
    name: string;
} | {
    type: 'expression';
    expression: string;
} | {
    type: 'query';
    query: string;
};
export interface FlowVariable {
    name: string;
    type: 'number' | 'string' | 'boolean' | 'platform' | 'game';
    value?: unknown;
    source?: 'user_input' | 'action_result' | 'system_query' | 'literal';
}
export interface ResponsiblePlayGuardrail {
    type: 'max_duration' | 'max_loss' | 'balance_floor' | 'max_iterations' | 'chase_detection' | 'cool_down_check' | 'daily_aggregate';
    value: number | boolean;
    source: 'user_specified' | 'system_default' | 'system_mandatory';
    overridable: boolean;
}
export interface FlowExecutionContext {
    flowId: string;
    executionId: string;
    userId: string;
    variables: Map<string, unknown>;
    startedAt: Date;
    currentNode: string;
    status: 'running' | 'paused' | 'completed' | 'failed' | 'stopped_by_guardrail';
    log: FlowExecutionLog[];
    metrics: FlowExecutionMetrics;
}
export interface FlowExecutionMetrics {
    totalDuration: number;
    actionsExecuted: number;
    conditionsEvaluated: number;
    loopIterations: number;
    platformsAccessed: string[];
    bonusesClaimed: number;
    bonusValueClaimed: number;
    spinsExecuted: number;
    totalWagered: number;
    totalWon: number;
    netResult: number;
    guardrailsTriggered: string[];
}
export interface FlowExecutionLog {
    timestamp: Date;
    nodeId: string;
    type: 'action_start' | 'action_complete' | 'action_failed' | 'condition_evaluated' | 'loop_iteration' | 'variable_set' | 'guardrail_triggered' | 'user_alert' | 'error';
    details: Record<string, unknown>;
}
export interface FlowPerformanceStats {
    totalExecutions?: number;
    successfulExecutions?: number;
    failedExecutions?: number;
    averageDuration?: number;
    averageNetResult?: number;
    lastExecutedAt?: Date;
}
export interface FlowInterpretationRequest {
    userId: string;
    rawInput: string;
    conversationHistory?: ConversationMessage[];
    existingFlows?: FlowDefinition[];
}
export interface FlowInterpretationResult {
    flow: FlowDefinition;
    confidence: number;
    humanReadableSummary: string;
    ambiguities?: Ambiguity[];
    warnings?: FlowWarning[];
    suggestedImprovements?: string[];
}
export interface ConversationMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}
export interface Ambiguity {
    field: string;
    possibleValues: string[];
    userInput: string;
    question: string;
}
export interface FlowWarning {
    type: 'responsible_play' | 'platform_limitation' | 'logic_error' | 'performance';
    severity: 'info' | 'warning' | 'error';
    message: string;
    suggestion?: string;
}
export interface EntityMap {
    platforms: PlatformEntity[];
    games: GameEntity[];
    actions: ActionEntity[];
    conditions: ConditionEntity[];
    schedules: ScheduleEntity[];
    amounts: AmountEntity[];
    durations: DurationEntity[];
    variables: VariableEntity[];
}
export interface PlatformEntity {
    name: string;
    normalized: string;
    confidence: number;
    aliases: string[];
}
export interface GameEntity {
    name: string;
    normalized: string;
    confidence: number;
    provider?: string;
}
export interface ActionEntity {
    text: string;
    type: FlowActionType;
    parameters?: Record<string, unknown>;
}
export interface ConditionEntity {
    text: string;
    type: 'comparison' | 'boolean' | 'expression';
    left?: string;
    operator?: string;
    right?: string;
}
export interface ScheduleEntity {
    text: string;
    cron: string;
    timezone: string;
    frequency: 'once' | 'daily' | 'weekly' | 'monthly' | 'custom';
}
export interface AmountEntity {
    text: string;
    type: 'absolute' | 'relative';
    value?: number;
    reference?: string;
    multiplier?: number;
}
export interface DurationEntity {
    text: string;
    type: 'time' | 'iteration';
    value: number;
    unit: 'minutes' | 'hours' | 'spins' | 'sessions';
}
export interface VariableEntity {
    name: string;
    source: 'action_result' | 'user_input' | 'system_query';
    type: 'number' | 'string' | 'boolean';
}
export interface ConversationState {
    userId: string;
    sessionId: string;
    currentFlow: Partial<FlowDefinition>;
    turns: ConversationTurn[];
    pendingQuestions: string[];
    status: 'building' | 'confirming' | 'modifying' | 'complete';
}
export interface ConversationTurn {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    flowState?: Partial<FlowDefinition>;
}
export interface SharedFlow {
    id: string;
    creatorId: string;
    title: string;
    description: string;
    category: FlowCategory;
    tags: string[];
    flowTemplate: FlowDefinition;
    pricing: 'free' | {
        amount: number;
        currency: 'USD';
    };
    stats: {
        imports: number;
        activeUsers: number;
        averageNetResult: number;
        averageTimeSavedMinutes: number;
        rating: number;
        reviews: number;
    };
    verifiedPerformance: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export type FlowCategory = 'bonus_collection' | 'play_strategy' | 'redemption_optimization' | 'multi_platform_routine' | 'jackpot_hunting' | 'bankroll_management' | 'responsible_play';
export declare const FlowTriggerSchema: z.ZodUnion<[z.ZodObject<{
    type: z.ZodLiteral<"scheduled">;
    cron: z.ZodString;
    timezone: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "scheduled";
    timezone: string;
    cron: string;
}, {
    type: "scheduled";
    timezone: string;
    cron: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"manual">;
}, "strip", z.ZodTypeAny, {
    type: "manual";
}, {
    type: "manual";
}>, z.ZodObject<{
    type: z.ZodLiteral<"event">;
    event: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "event";
    event: string;
}, {
    type: "event";
    event: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"condition">;
    condition: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "condition";
    condition: string;
}, {
    type: "condition";
    condition: string;
}>]>;
export declare const FlowValueSchema: z.ZodType<FlowValue>;
export declare const ResponsiblePlayGuardrailSchema: z.ZodObject<{
    type: z.ZodEnum<["max_duration", "max_loss", "balance_floor", "max_iterations", "chase_detection", "cool_down_check", "daily_aggregate"]>;
    value: z.ZodUnion<[z.ZodNumber, z.ZodBoolean]>;
    source: z.ZodEnum<["user_specified", "system_default", "system_mandatory"]>;
    overridable: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    value: number | boolean;
    type: "max_duration" | "max_loss" | "balance_floor" | "max_iterations" | "chase_detection" | "cool_down_check" | "daily_aggregate";
    source: "user_specified" | "system_default" | "system_mandatory";
    overridable: boolean;
}, {
    value: number | boolean;
    type: "max_duration" | "max_loss" | "balance_floor" | "max_iterations" | "chase_detection" | "cool_down_check" | "daily_aggregate";
    source: "user_specified" | "system_default" | "system_mandatory";
    overridable: boolean;
}>;
export declare const FlowInterpretationRequestSchema: z.ZodObject<{
    userId: z.ZodString;
    rawInput: z.ZodString;
    conversationHistory: z.ZodOptional<z.ZodArray<z.ZodObject<{
        role: z.ZodString;
        content: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        content: string;
        role: string;
    }, {
        content: string;
        role: string;
    }>, "many">>;
    existingFlows: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
}, "strip", z.ZodTypeAny, {
    userId: string;
    rawInput: string;
    conversationHistory?: {
        content: string;
        role: string;
    }[] | undefined;
    existingFlows?: any[] | undefined;
}, {
    userId: string;
    rawInput: string;
    conversationHistory?: {
        content: string;
        role: string;
    }[] | undefined;
    existingFlows?: any[] | undefined;
}>;
//# sourceMappingURL=types.d.ts.map
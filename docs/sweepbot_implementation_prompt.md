# SweepBot Phase 2: Natural Language Automation Engine + Top 25 Feature Expansion

## IMPLEMENTATION PROMPT FOR CLAUDE CODE

You are implementing a massive feature expansion for SweepBot, an existing TypeScript monorepo. The codebase uses Fastify backend with Drizzle ORM, React frontend with TanStack Router, a WXT browser extension, and Supabase/PostgreSQL for the database. The project already has ~13,000 lines of production code across ~101 files with core session tracking, analytics, the Trust Index, responsible play, and automation scaffolding in place.

This prompt specifies two major bodies of work:

1. **SweepBot Flows** — A natural language automation scripting engine (THE flagship differentiator)
2. **Top 25 Features** — High-impact features that deepen the data moat, increase engagement, and drive monetization

All code must be production-grade TypeScript. Fully typed. Error-handled. Well-commented. Organized into the existing monorepo structure. Use Drizzle ORM for all database schemas. Use Zod for all validation. Follow existing project conventions.

---

# PART 1: SWEEPBOT FLOWS — Natural Language Automation Engine

## What This Is

SweepBot Flows is a system where users type plain English instructions and SweepBot converts them into executable, schedulable, multi-platform automation scripts. The user never sees code, never touches a flowchart builder, never drags and drops anything. They just _talk_ to SweepBot the way they'd talk to a friend, and SweepBot does what they ask.

**Example user input:**

> "Every day at 3:30, open Chumba, grab my daily bonus, throw it on Sweet Bonanza at minimum bet. If I hit over 5x what the bonus was, keep going. If not, stop and close out."

**SweepBot responds with a structured confirmation:**

> Here's what I'll do:
>
> - ⏰ Trigger: Daily at 3:30 PM
> - 🌐 Open Chumba Casino, log in
> - 🎁 Claim daily login bonus → store as $BONUS
> - 🎰 Open Sweet Bonanza, set minimum bet
> - 🔄 Spin → IF win > 5× $BONUS → continue spinning
> - 🛑 IF win ≤ 5× $BONUS → stop, close platform, log session
>
> Want me to activate this starting tomorrow?

User confirms, and the Flow is live.

## Architecture Overview

### 1. NLP Interpretation Layer (`packages/flows/src/interpreter/`)

This layer converts natural language into a structured Flow Definition (a JSON AST — abstract syntax tree — representing the automation logic).

#### `interpreter.ts` — Main Interpreter Service

```typescript
// The core service that takes raw user text and produces a FlowDefinition
// Uses a multi-pass approach:
//   Pass 1: Intent Classification — what type of automation is this?
//   Pass 2: Entity Extraction — platforms, games, amounts, times, conditions
//   Pass 3: Logic Structuring — build the conditional tree
//   Pass 4: Validation — ensure the flow is safe, complete, and executable

interface FlowInterpretationRequest {
  userId: string
  rawInput: string
  conversationHistory?: ConversationMessage[] // for multi-turn refinement
  existingFlows?: FlowDefinition[] // context of what user already has
}

interface FlowInterpretationResult {
  flow: FlowDefinition
  confidence: number // 0-1, how confident we are in the interpretation
  humanReadableSummary: string // plain English confirmation
  ambiguities?: Ambiguity[] // things we need to clarify
  warnings?: FlowWarning[] // responsible play concerns, platform limitations
  suggestedImprovements?: string[] // "Did you also want to..."
}
```

#### `entities.ts` — Domain Entity Recognition

```typescript
// Recognizes sweepstakes-specific entities from natural language:
//
// PLATFORMS: "Chumba", "LuckyLand", "Stake", "Pulsz", "WOW Vegas", etc.
//   - Fuzzy matching: "chumba", "Chumba Casino", "CC" all resolve to CHUMBA
//   - Learns user nicknames over time: if a user always says "lucky" for LuckyLand, learn that
//
// GAMES: "Sweet Bonanza", "Gates of Olympus", "Sugar Rush", etc.
//   - Match against Game Intelligence Database
//   - Fuzzy: "sweet bo", "bonanza", "SB" → Sweet Bonanza
//
// ACTIONS: "claim bonus", "grab daily", "collect coins", "spin", "bet", "cash out", "redeem"
//   - Map to automation engine action types
//   - "throw it on" = open game and bet
//   - "grab my daily" = claim login bonus
//   - "cash out" = initiate redemption
//
// CONDITIONS: "if I win", "when balance drops below", "unless", "until", "as long as"
//   - Map to conditional operators
//   - Support comparisons: >, <, >=, <=, ==, !=
//   - Support relative references: "5x the bonus", "double my balance", "half my deposit"
//
// TEMPORAL: "every day at 3:30", "weekdays only", "Monday Wednesday Friday",
//           "every 4 hours", "once a week on Sunday morning"
//   - Parse into cron-compatible schedule definitions
//   - Support natural language time: "morning" = 7-9 AM, "evening" = 6-8 PM
//
// AMOUNTS: "$5", "minimum bet", "max bet", "half my balance", "the bonus amount"
//   - Support absolute and relative amounts
//   - Support variable references: "the bonus" refers to a previously stored value
//
// DURATIONS: "for 30 minutes", "until I've spent $20", "for 100 spins"
//   - Map to stop conditions

interface EntityMap {
  platforms: PlatformEntity[]
  games: GameEntity[]
  actions: ActionEntity[]
  conditions: ConditionEntity[]
  schedules: ScheduleEntity[]
  amounts: AmountEntity[]
  durations: DurationEntity[]
  variables: VariableEntity[]
}
```

#### `flow-definition.ts` — The Flow AST

```typescript
// A Flow is a tree of nodes. Each node is an action, condition, loop, or control flow.

interface FlowDefinition {
  id: string
  userId: string
  name: string // auto-generated or user-named
  description: string // the original natural language input
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

type FlowTrigger =
  | { type: 'scheduled'; cron: string; timezone: string }
  | { type: 'manual' }
  | { type: 'event'; event: FlowEventType } // e.g., "when a new bonus drops"
  | { type: 'condition'; condition: FlowConditionNode } // e.g., "when jackpot exceeds $X"

type FlowNode =
  | FlowActionNode
  | FlowConditionNode
  | FlowLoopNode
  | FlowSequenceNode
  | FlowParallelNode
  | FlowWaitNode
  | FlowStopNode
  | FlowAlertNode
  | FlowStoreNode

interface FlowActionNode {
  type: 'action'
  id: string
  action: AutomationAction // maps to the automation engine's action types
  platform: string
  parameters: Record<string, any>
  timeout: number // max time to wait for this action
  onFailure: 'skip' | 'retry' | 'stop' | FlowNode
  next?: FlowNode
}

interface FlowConditionNode {
  type: 'condition'
  id: string
  left: FlowValue // what we're comparing
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=' | 'contains' | 'exists'
  right: FlowValue // what we're comparing against
  onTrue: FlowNode
  onFalse?: FlowNode
}

interface FlowLoopNode {
  type: 'loop'
  id: string
  condition: FlowConditionNode // keep looping while this is true
  body: FlowNode
  maxIterations: number // safety cap — responsible play
  maxDuration: number // max time in ms — responsible play
}

interface FlowSequenceNode {
  type: 'sequence'
  id: string
  steps: FlowNode[]
}

interface FlowParallelNode {
  type: 'parallel'
  id: string
  branches: FlowNode[]
  waitFor: 'all' | 'any' | 'none'
}

type FlowValue =
  | { type: 'literal'; value: number | string | boolean }
  | { type: 'variable'; name: string }
  | { type: 'expression'; expression: string } // e.g., "$BONUS * 5"
  | { type: 'query'; query: DataQuery } // e.g., "my balance on Chumba"

interface FlowVariable {
  name: string
  type: 'number' | 'string' | 'boolean' | 'platform' | 'game'
  value?: any
  source?: 'user_input' | 'action_result' | 'system_query' | 'literal'
}
```

#### `responsible-play-validator.ts` — Guardrail Enforcement

```typescript
// CRITICAL: Every Flow MUST pass through responsible play validation before activation.
// This is non-negotiable. SweepBot will NEVER execute a Flow that violates responsible play.
//
// Mandatory guardrails injected into every Flow:
//
// 1. MAX SESSION DURATION — Every Flow must have an absolute time cap.
//    If the user doesn't specify one, default to 2 hours, inform the user.
//
// 2. MAX LOSS LIMIT — Every Flow that involves betting must have a loss ceiling.
//    If the user doesn't specify one, ask. Never default to "unlimited."
//
// 3. CHASE DETECTION — If a Flow's logic could result in chasing losses
//    (e.g., "if I lose, double my bet"), flag it and require explicit acknowledgment.
//    Include a mandatory cool-down after 3 consecutive losing conditions.
//
// 4. INFINITE LOOP PROTECTION — Every loop must have a max iteration count
//    AND a max duration. No exceptions.
//
// 5. BALANCE FLOOR — User can set a "never let my balance drop below X" guard
//    that overrides all Flow logic. Hard stop.
//
// 6. DAILY AGGREGATE LIMITS — Even across multiple Flows, total daily losses
//    and total daily play time are capped per user settings.
//
// 7. COOL-DOWN ENFORCEMENT — If user has a cool-down active (from responsible
//    play suite), no Flows execute. Period.

interface ResponsiblePlayGuardrail {
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

interface FlowValidationResult {
  valid: boolean
  guardrailsApplied: ResponsiblePlayGuardrail[]
  guardrailsInjected: ResponsiblePlayGuardrail[] // ones we added that user didn't specify
  warnings: string[]
  errors: string[]
  requiresUserAcknowledgment: boolean // if chase detection or risky patterns found
  acknowledgmentPrompt?: string
}
```

### 2. Flow Execution Engine (`packages/flows/src/executor/`)

#### `executor.ts` — The Runtime

```typescript
// The executor takes a FlowDefinition and runs it against the automation engine.
// It maintains execution state, handles failures, respects guardrails, and logs everything.

interface FlowExecutionContext {
  flowId: string
  executionId: string // unique per run
  userId: string
  variables: Map<string, any>
  startedAt: Date
  currentNode: string // ID of the currently executing node
  status: 'running' | 'paused' | 'completed' | 'failed' | 'stopped_by_guardrail'
  log: FlowExecutionLog[]
  metrics: FlowExecutionMetrics
}

interface FlowExecutionLog {
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
  details: Record<string, any>
}

interface FlowExecutionMetrics {
  totalDuration: number
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

// The executor MUST:
// 1. Check responsible play status before EVERY execution
// 2. Log every action for analytics and auditability
// 3. Respect all guardrails — hard stops are non-negotiable
// 4. Handle platform errors gracefully (site down, login failed, etc.)
// 5. Send real-time status updates to the user if they're online
// 6. Generate a complete execution summary when done
// 7. Feed all session data back into the analytics engine
```

#### `scheduler.ts` — Cron Scheduling

```typescript
// Manages scheduled Flow executions.
// Uses node-cron or bull/bullmq for job scheduling.
// Each active Flow with a scheduled trigger gets a job in the queue.
//
// Features:
// - Timezone-aware scheduling (user's local time)
// - Conflict detection: if two Flows try to use the same platform at the same time, queue them
// - Priority system: user can set Flow priority order
// - Missed execution handling: if the system was down, decide whether to run missed Flows
// - Smart scheduling: if a platform has known maintenance windows, avoid those
// - Execution windows: user can set "only run my Flows between 6 AM and 11 PM"
```

### 3. Conversational Flow Builder (`packages/flows/src/conversation/`)

#### `conversation-manager.ts` — Multi-Turn Flow Creation

```typescript
// Users don't always specify everything in one message. This manages
// the back-and-forth conversation of building and refining a Flow.
//
// Example multi-turn conversation:
//
// User: "I want to auto-collect bonuses every morning"
// Bot: "Got it — collect daily bonuses every morning. Which platforms?
//       You're currently tracking: Chumba, LuckyLand, Pulsz, Stake.us, WOW Vegas"
// User: "All of them"
// Bot: "All 5 platforms. What time?"
// User: "7 AM"
// Bot: "Here's your Flow:
//       ⏰ Every day at 7:00 AM
//       🌐 Log in to Chumba → claim bonus
//       🌐 Log in to LuckyLand → claim bonus
//       🌐 Log in to Pulsz → claim bonus
//       🌐 Log in to Stake.us → claim bonus
//       🌐 Log in to WOW Vegas → claim bonus
//       📊 Log all results, send summary notification
//       Activate?"
// User: "Yeah but do Chumba first always, it has the best bonus"
// Bot: "Updated — Chumba runs first. Activate?"
// User: "Yes"
//
// The conversation manager maintains state across turns and supports:
// - Incremental refinement ("actually change the time to 8")
// - Adding conditions after the fact ("also, skip any platform with Trust Index below 50")
// - Combining Flows ("merge this with my evening routine")
// - Cloning and modifying ("make a copy of my morning flow but for weekends only")
// - Natural language editing of active Flows ("pause my Chumba flow for a week")

interface ConversationState {
  userId: string
  sessionId: string
  currentFlow: Partial<FlowDefinition>
  turns: ConversationTurn[]
  pendingQuestions: string[]
  status: 'building' | 'confirming' | 'modifying' | 'complete'
}
```

### 4. Flow Sharing & Marketplace (`packages/flows/src/marketplace/`)

```typescript
// Users can share their Flows as natural language "recipes."
// A shared Flow is the original English description + the structured definition.
//
// When another user imports a shared Flow:
// 1. They see the plain English description
// 2. SweepBot adapts it to their platforms/games (e.g., swapping game names)
// 3. They can customize before activating
// 4. Original creator gets credit + optional revenue share
//
// Premium users can SELL their Flows on the marketplace.
// SweepBot takes 20% commission.
// Flows have ratings, verified performance data, and usage counts.

interface SharedFlow {
  id: string
  creatorId: string
  title: string
  description: string // the natural language recipe
  category: FlowCategory
  tags: string[]
  flowTemplate: FlowDefinition // with platform/game references as variables
  pricing: 'free' | { amount: number; currency: 'USD' }
  stats: {
    imports: number
    activeUsers: number
    averageNetResult: number // verified by SweepBot data
    averageTimeSaved: number // minutes per execution
    rating: number
    reviews: number
  }
  verifiedPerformance: boolean // SweepBot has enough data to verify claims
}

type FlowCategory =
  | 'bonus_collection'
  | 'play_strategy'
  | 'redemption_optimization'
  | 'multi_platform_routine'
  | 'jackpot_hunting'
  | 'bankroll_management'
  | 'responsible_play'
```

### 5. Database Schema (Drizzle ORM)

```typescript
// Add to existing schema files:

// flows table
export const flows = pgTable('flows', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description').notNull(), // original natural language
  definition: jsonb('definition').notNull(), // FlowDefinition JSON
  trigger: jsonb('trigger').notNull(), // FlowTrigger JSON
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  version: integer('version').notNull().default(1),
  guardrails: jsonb('guardrails').notNull(), // ResponsiblePlayGuardrail[]
  isShared: boolean('is_shared').notNull().default(false),
  sharedFlowId: uuid('shared_flow_id').references(() => sharedFlows.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  lastExecutedAt: timestamp('last_executed_at'),
  executionCount: integer('execution_count').notNull().default(0),
})

// flow_executions table — every single run is logged
export const flowExecutions = pgTable('flow_executions', {
  id: uuid('id').primaryKey().defaultRandom(),
  flowId: uuid('flow_id')
    .notNull()
    .references(() => flows.id),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  status: varchar('status', { length: 30 }).notNull(),
  startedAt: timestamp('started_at').notNull(),
  completedAt: timestamp('completed_at'),
  metrics: jsonb('metrics').notNull(), // FlowExecutionMetrics
  log: jsonb('log').notNull(), // FlowExecutionLog[]
  guardrailsTriggered: jsonb('guardrails_triggered'),
  errorDetails: text('error_details'),
})

// flow_conversations table — multi-turn building history
export const flowConversations = pgTable('flow_conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  flowId: uuid('flow_id').references(() => flows.id),
  turns: jsonb('turns').notNull(),
  status: varchar('status', { length: 20 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// shared_flows table — marketplace
export const sharedFlows = pgTable('shared_flows', {
  id: uuid('id').primaryKey().defaultRandom(),
  creatorId: uuid('creator_id')
    .notNull()
    .references(() => users.id),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  category: varchar('category', { length: 50 }).notNull(),
  tags: jsonb('tags').notNull().default([]),
  flowTemplate: jsonb('flow_template').notNull(),
  priceCents: integer('price_cents').notNull().default(0), // 0 = free
  imports: integer('imports').notNull().default(0),
  activeUsers: integer('active_users').notNull().default(0),
  avgNetResult: decimal('avg_net_result', { precision: 10, scale: 2 }),
  avgTimeSavedMinutes: decimal('avg_time_saved_minutes', { precision: 8, scale: 2 }),
  rating: decimal('rating', { precision: 3, scale: 2 }),
  reviewCount: integer('review_count').notNull().default(0),
  verifiedPerformance: boolean('verified_performance').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
```

### 6. API Endpoints (Fastify)

```typescript
// POST /api/flows/interpret
// Takes raw natural language, returns FlowInterpretationResult
// Used for the first message in a Flow creation conversation

// POST /api/flows/converse
// Continues a multi-turn Flow building conversation
// Takes conversationId + new user message

// POST /api/flows
// Creates/saves a Flow from a confirmed FlowDefinition

// PATCH /api/flows/:id
// Update a Flow (status, definition, guardrails, etc.)

// POST /api/flows/:id/execute
// Manually trigger a Flow execution

// GET /api/flows/:id/executions
// Get execution history for a Flow

// GET /api/flows/:id/executions/:executionId
// Get detailed execution log

// DELETE /api/flows/:id
// Archive a Flow (soft delete)

// GET /api/flows/marketplace
// Browse shared Flows with filtering/sorting

// POST /api/flows/marketplace/:sharedFlowId/import
// Import a shared Flow into your account

// POST /api/flows/marketplace
// Share/publish a Flow to the marketplace

// GET /api/flows/suggestions
// AI-powered Flow suggestions based on user's platforms and play patterns
```

### 7. Frontend Components (React)

```
packages/frontend/src/features/flows/
├── FlowsPage.tsx              — Main Flows dashboard, list of user's Flows
├── FlowChat.tsx               — The conversational Flow builder (chat interface)
├── FlowDetail.tsx             — Single Flow view with status, stats, execution history
├── FlowExecutionView.tsx      — Detailed execution log viewer
├── FlowConfirmation.tsx       — The structured confirmation card before activation
├── FlowMarketplace.tsx        — Browse/search/import shared Flows
├── FlowPerformanceChart.tsx   — Execution metrics over time
├── components/
│   ├── FlowCard.tsx           — Compact Flow summary card
│   ├── FlowStatusBadge.tsx    — Active/Paused/Draft indicator
│   ├── FlowGuardrailDisplay.tsx — Shows active responsible play guardrails
│   ├── FlowExecutionTimeline.tsx — Visual timeline of a single execution
│   ├── FlowScheduleDisplay.tsx — Shows when the Flow runs next
│   └── FlowNaturalLanguageInput.tsx — The main text input with smart suggestions
```

### 8. NLP Integration Strategy

The NLP interpretation layer should use a **hybrid approach**:

1. **Rule-based entity extraction FIRST** — Fast, deterministic, no API cost. A comprehensive regex + keyword system that handles the most common patterns. This handles 70-80% of inputs.

2. **LLM fallback for complex/ambiguous inputs** — When the rule-based system can't confidently parse the input (confidence < 0.7), route to an LLM API call (Claude API or OpenAI) with a carefully crafted system prompt that includes:
   - The full entity vocabulary (platforms, games, actions)
   - The FlowDefinition schema
   - Examples of natural language → FlowDefinition mappings
   - Responsible play constraints

3. **User feedback loop** — Every time a user corrects an interpretation ("no, I meant LuckyLand not Lucky Tiger"), that correction trains the rule-based system. Store these as entity aliases per user AND globally (if enough users make the same correction).

**Cost management:** Rule-based first, LLM only when needed. Cache common patterns. The goal is <$0.01 per Flow creation on average.

---

# PART 2: TOP 25 FEATURES — Implementation Specifications

Implement each of the following as complete features with database schema, API endpoints, backend services, and frontend components. All integrate with the existing SweepBot architecture.

---

## Feature 1: Smart Wagering Autopilot

Automatically completes wagering requirements using optimal game selection.

**Schema:**

```typescript
export const wageringTasks = pgTable('wagering_tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  platformId: uuid('platform_id')
    .notNull()
    .references(() => platforms.id),
  requiredWagerAmount: decimal('required_wager_amount', { precision: 12, scale: 2 }).notNull(),
  completedWagerAmount: decimal('completed_wager_amount', { precision: 12, scale: 2 })
    .notNull()
    .default('0'),
  strategy: varchar('strategy', { length: 30 }).notNull().default('minimize_loss'), // minimize_loss | maximize_speed | balanced
  selectedGames: jsonb('selected_games').notNull(), // games chosen by algorithm (lowest volatility + highest RTP)
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  totalLostDuringPlaythrough: decimal('total_lost', { precision: 10, scale: 2 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
```

**Logic:** Query Game Intelligence DB for games on the target platform, sort by (highest RTP + lowest volatility), auto-play minimum bets until requirement met. Integrate with Flows engine for scheduling.

---

## Feature 2: Daily Digest Briefing

Morning report delivered via push notification, email, and in-app.

**Schema:**

```typescript
export const dailyDigests = pgTable('daily_digests', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  date: date('date').notNull(),
  content: jsonb('content').notNull(), // structured digest data
  deliveredVia: jsonb('delivered_via').notNull(), // ['push', 'email', 'in_app']
  openedAt: timestamp('opened_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
```

**Content includes:** overnight Flow execution summaries, bonuses available today, yesterday's P&L, portfolio balance, Trust Index changes for tracked platforms, new game releases, pending redemption updates, community highlights.

---

## Feature 3: Hot/Cold Streak Detection

Statistical analysis of session patterns with variance modeling.

**Service:** Analyze user's recent sessions using standard deviation from expected RTP. Flag streaks that exceed 2σ (notable) or 3σ (extreme). Show on dashboard as a visual streak indicator. Important: ALWAYS include the disclaimer that past results don't predict future outcomes. This is informational, not predictive.

---

## Feature 4: Platform Health Monitor

Real-time uptime, load time, and error rate tracking for every platform.

**Schema:**

```typescript
export const platformHealthChecks = pgTable('platform_health_checks', {
  id: uuid('id').primaryKey().defaultRandom(),
  platformId: uuid('platform_id')
    .notNull()
    .references(() => platforms.id),
  checkedAt: timestamp('checked_at').notNull(),
  isUp: boolean('is_up').notNull(),
  responseTimeMs: integer('response_time_ms'),
  errorType: varchar('error_type', { length: 50 }),
  region: varchar('region', { length: 20 }),
})

export const platformHealthSummary = pgTable('platform_health_summary', {
  platformId: uuid('platform_id')
    .primaryKey()
    .references(() => platforms.id),
  uptimePercent7d: decimal('uptime_7d', { precision: 5, scale: 2 }),
  uptimePercent30d: decimal('uptime_30d', { precision: 5, scale: 2 }),
  avgResponseTimeMs: integer('avg_response_time_ms'),
  currentStatus: varchar('current_status', { length: 20 }).notNull(),
  lastDownAt: timestamp('last_down_at'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
```

**Service:** Run health checks every 5 minutes per platform. Store results. Feed into Trust Index. Alert users if a platform they have pending redemptions on goes down.

---

## Feature 5: Bonus Efficiency Score

Rate every bonus offer by actual expected value after wagering requirements.

**Calculation:** `EV = (Bonus Amount × Average RTP During Playthrough) - (Wagering Requirement × (1 - Average RTP))`. Score from 0-100. Display on Bonus Calendar alongside each offer. Tells users which "deals" are actually worth claiming vs. which ones will cost them more than they gain.

---

## Feature 6: Session Replay Summaries

AI-generated natural language summary of every play session.

**Example output:** "Tuesday evening session on Chumba Casino — 2 hours 14 minutes. You played 847 spins across 3 games. Sweet Bonanza was your big winner: hit the bonus round twice with a 214x payout on the second trigger. Gates of Olympus was cold — 0 bonus hits in 200 spins, RTP at 71%. Overall session: +$34.20. Your Chumba RTP this week is trending above average at 98.1%."

**Implementation:** Post-session hook that takes raw session data and generates summary via template engine (rule-based for speed) with LLM fallback for complex sessions.

---

## Feature 7: Win/Loss Heatmaps

Visual calendar showing daily performance across all platforms.

**Frontend:** Calendar grid component. Each day is colored on a gradient from deep red (worst loss) to deep green (best win). Click a day to drill into session details. Filter by platform, by game, by time period. Show weekly/monthly/yearly views. This becomes one of the most screenshotted features — viral marketing.

---

## Feature 8: Predictive Balance Modeling

Project future balances based on current play patterns.

**Calculation:** Use user's rolling 30-day average daily P&L, apply to current balance, project forward 7/30/90 days with confidence intervals. Show as a line chart with shaded confidence bands. Include scenario modeling: "If you continue current play: X. If you reduce session time by 30%: Y. If you switch to higher-RTP games: Z."

Responsible play integration: if the projection shows balance trending to zero, flag it gently and proactively.

---

## Feature 9: New Game Alert System

Instant notifications when new games launch on tracked platforms.

**Service:** Monitor tracked platforms for new game additions (via automation engine DOM scanning). Cross-reference with Game Intelligence DB for provider data. Push notification to users who play on that platform. Include: game name, provider, theoretical RTP if available, volatility class, bonus type. Early community reports start populating within hours of launch.

---

## Feature 10: Verified Big Win Board

Crowdsourced, data-verified leaderboard of community wins.

**Schema:**

```typescript
export const verifiedWins = pgTable('verified_wins', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => sessions.id),
  platformId: uuid('platform_id')
    .notNull()
    .references(() => platforms.id),
  gameName: varchar('game_name', { length: 255 }).notNull(),
  betAmount: decimal('bet_amount', { precision: 10, scale: 2 }).notNull(),
  winAmount: decimal('win_amount', { precision: 12, scale: 2 }).notNull(),
  multiplier: decimal('multiplier', { precision: 10, scale: 2 }).notNull(),
  isBonusRound: boolean('is_bonus_round').notNull(),
  verificationStatus: varchar('verification_status', { length: 20 })
    .notNull()
    .default('auto_verified'),
  screenshotUrl: varchar('screenshot_url', { length: 500 }),
  occurredAt: timestamp('occurred_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
```

**Key:** These wins are verified by SweepBot's session tracking data — not screenshots that can be faked. Massive trust differentiator. Leaderboards: daily, weekly, monthly, all-time. Filter by platform, game, bet size.

---

## Feature 11: Crew System

Form groups with friends, share stats, compete, run challenges.

**Schema:**

```typescript
export const crews = pgTable('crews', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  creatorId: uuid('creator_id')
    .notNull()
    .references(() => users.id),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  maxMembers: integer('max_members').notNull().default(10),
  isPublic: boolean('is_public').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const crewMembers = pgTable(
  'crew_members',
  {
    crewId: uuid('crew_id')
      .notNull()
      .references(() => crews.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    role: varchar('role', { length: 20 }).notNull().default('member'),
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
  },
  (t) => ({ pk: primaryKey(t.crewId, t.userId) })
)

export const crewChallenges = pgTable('crew_challenges', {
  id: uuid('id').primaryKey().defaultRandom(),
  crewId: uuid('crew_id')
    .notNull()
    .references(() => crews.id),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  metric: varchar('metric', { length: 50 }).notNull(), // 'total_wins', 'highest_multiplier', 'most_bonuses', etc.
  startsAt: timestamp('starts_at').notNull(),
  endsAt: timestamp('ends_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
```

---

## Feature 12: Achievement System

Badges, milestones, streaks that make SweepBot itself sticky.

**Categories:** Milestone badges (first session tracked, 100th session, etc.), streak badges (7-day, 30-day, 365-day tracking streak), performance badges (hit a 100x+, complete a wagering requirement, fastest redemption), community badges (first review, helpful mentor, top contributor), responsible play badges (set limits, completed cool-down, 30 days under budget). Display on user profile. Shareable. Achievement notifications.

**Schema:**

```typescript
export const achievements = pgTable('achievements', {
  id: varchar('id', { length: 50 }).primaryKey(), // e.g., 'first_session', 'streak_30d'
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description').notNull(),
  category: varchar('category', { length: 30 }).notNull(),
  iconUrl: varchar('icon_url', { length: 500 }),
  rarity: varchar('rarity', { length: 20 }).notNull(), // common, uncommon, rare, epic, legendary
  criteria: jsonb('criteria').notNull(), // machine-readable unlock conditions
})

export const userAchievements = pgTable(
  'user_achievements',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    achievementId: varchar('achievement_id', { length: 50 })
      .notNull()
      .references(() => achievements.id),
    unlockedAt: timestamp('unlocked_at').defaultNow().notNull(),
    metadata: jsonb('metadata'), // context about how they unlocked it
  },
  (t) => ({ pk: primaryKey(t.userId, t.achievementId) })
)
```

---

## Feature 13: Year-in-Review Generator

End-of-year shareable infographic. Viral marketing engine.

**Data points:** Total spins, total sessions, total hours, biggest win (with game/platform), worst session, most-played game, most-used platform, total bonuses claimed, total bonuses value, total redeemed, total deposited, net P&L, number of Flows run, time saved by automation, responsible play stats (limits respected, cool-downs taken), community rank, achievements unlocked.

**Output:** Beautiful, branded, shareable image (server-side rendered via Satori or Puppeteer). Optimized for social sharing dimensions. Watermarked with SweepBot branding. Every share is free advertising.

---

## Feature 14: Gold Coin Package Value Ranker

Compares every purchase option across platforms by actual value per dollar.

**Schema:**

```typescript
export const goldCoinPackages = pgTable('gold_coin_packages', {
  id: uuid('id').primaryKey().defaultRandom(),
  platformId: uuid('platform_id')
    .notNull()
    .references(() => platforms.id),
  packageName: varchar('package_name', { length: 255 }).notNull(),
  priceCents: integer('price_cents').notNull(),
  goldCoins: integer('gold_coins').notNull(),
  bonusSweepCoins: decimal('bonus_sweep_coins', { precision: 10, scale: 2 }).notNull(),
  bonusGoldCoins: integer('bonus_gold_coins').notNull().default(0),
  valuePerDollar: decimal('value_per_dollar', { precision: 10, scale: 4 }).notNull(), // calculated
  isPromotion: boolean('is_promotion').notNull().default(false),
  promotionExpiresAt: timestamp('promotion_expires_at'),
  scrapedAt: timestamp('scraped_at').defaultNow().notNull(),
})
```

**Service:** Scrape package pages on each platform, calculate value-per-dollar, rank globally across all platforms. Alert users when exceptional deals appear. Track historical pricing to detect patterns (e.g., "Chumba always runs a 3x bonus on the first of the month").

---

## Feature 15: Purchase Timing Optimizer

Tracks historical pricing patterns and alerts when best deals typically drop.

**Implementation:** Build on top of gold coin package history data. Detect recurring patterns using time-series analysis (day of week, day of month, holidays, platform-specific events). When a user is about to purchase, show: "This platform typically offers a 2x bonus next Tuesday. Consider waiting."

---

## Feature 16: Account Breach Monitor

Monitor for data breaches at tracked platforms.

**Service:** Integrate with Have I Been Pwned API or similar. Monitor platform domain breach databases. If a breach is detected at a platform the user has credentials stored for, immediate high-priority alert. Recommend password change. If using SweepBot Vault, offer one-click password rotation.

---

## Feature 17: VPN Compliance Checker

Detect VPN and warn about platform TOS violations.

**Service:** Browser extension checks if traffic is routing through known VPN endpoints. Cross-reference with platform TOS regarding VPN usage. If violation detected, warn user before they play — preventing potential balance freezes or account bans. Simple check, massive value: protects users from losing their entire balance to a TOS violation they didn't know about.

---

## Feature 18: Daily Challenges

Engagement-driving daily challenges that increase platform stickiness.

**Examples:** "Try a game you've never played before," "Play on 3 different platforms today," "Complete a redemption," "Set a new personal RTP record on any game," "Claim bonuses on all tracked platforms," "Share a Flow with the community."

**Schema:**

```typescript
export const dailyChallenges = pgTable('daily_challenges', {
  id: uuid('id').primaryKey().defaultRandom(),
  date: date('date').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  criteria: jsonb('criteria').notNull(), // machine-readable completion conditions
  rewardType: varchar('reward_type', { length: 30 }).notNull(), // 'xp', 'badge', 'marketplace_credit'
  rewardValue: integer('reward_value').notNull(),
})

export const userChallengeProgress = pgTable(
  'user_challenge_progress',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    challengeId: uuid('challenge_id')
      .notNull()
      .references(() => dailyChallenges.id),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    progress: decimal('progress', { precision: 5, scale: 2 }).notNull().default('0'), // 0-100
    completedAt: timestamp('completed_at'),
  },
  (t) => ({ pk: primaryKey(t.userId, t.challengeId) })
)
```

---

## Feature 19: New Platform Scout

Automatically detect and profile new sweepstakes casino launches.

**Service:** Automated web monitoring for new sweepstakes casino launches. Check social media mentions, domain registrations, affiliate network new offerings. When a new platform is detected: create a stub profile, begin health monitoring, flag to community for early reports. First 30 days of a new platform's data is especially valuable — establishes the baseline Trust Index.

---

## Feature 20: Customer Support Scorecards

Track support quality per platform based on community data.

**Schema:**

```typescript
export const supportInteractions = pgTable('support_interactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  platformId: uuid('platform_id')
    .notNull()
    .references(() => platforms.id),
  category: varchar('category', { length: 50 }).notNull(), // 'redemption_issue', 'account_problem', 'technical', 'bonus_dispute'
  contactMethod: varchar('contact_method', { length: 30 }).notNull(), // 'live_chat', 'email', 'phone'
  responseTimeMinutes: integer('response_time_minutes'),
  resolutionTimeMinutes: integer('resolution_time_minutes'),
  wasResolved: boolean('was_resolved'),
  satisfactionRating: integer('satisfaction_rating'), // 1-5
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
```

**Aggregation:** Per-platform support scorecard: avg response time, avg resolution time, resolution rate, satisfaction score. Feed into Trust Index. Invaluable data that no one else collects.

---

## Feature 21: Affiliate Offer Comparator

Find the best signup deal for any platform.

**Service:** When a user wants to join a new platform, SweepBot searches known affiliate offers and shows the best available signup bonus, referral code, or promotional deal. SweepBot uses its OWN affiliate links by default (revenue!), but transparently shows the user what they're getting. If a third-party offer is objectively better, show it — trust > short-term revenue.

---

## Feature 22: Regulatory Radar

Track state-by-state legislative activity.

**Service:** Monitor state legislature databases, gaming commission announcements, and legal news for sweepstakes-related regulatory changes. Alert users in affected states. Maintain a compliance database: which platforms are legal in which states, pending legislation, recent enforcement actions. Feeds into Geo-Compliance Module.

---

## Feature 23: Game Tutorial Library

Short guides for every tracked game.

**Schema:**

```typescript
export const gameTutorials = pgTable('game_tutorials', {
  id: uuid('id').primaryKey().defaultRandom(),
  gameId: uuid('game_id')
    .notNull()
    .references(() => games.id),
  content: text('content').notNull(), // markdown
  bonusMechanics: text('bonus_mechanics'), // how the bonus works
  symbolGuide: jsonb('symbol_guide'), // symbol → payout mapping
  communityTips: jsonb('community_tips'), // user-contributed tips
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
```

**Content:** How the game works, what the symbols pay, how the bonus triggers, what the bonus does, any special mechanics, community tips. Auto-generated framework from game provider data, enriched by community contributions.

---

## Feature 24: Weekly Market Report

AI-generated newsletter — the "SweepBot Weekly."

**Content:** New game launches this week, platform Trust Index movers (up and down), biggest community wins, bonus highlights for next week, regulatory updates, top-performing Flows from the marketplace, tip of the week. Auto-generated from SweepBot data. Delivered via email and in-app. Free tier gets abbreviated version. Premium gets full report.

---

## Feature 25: Personal Records Tracker

Track and display personal bests like a sports stats card.

**Schema:**

```typescript
export const personalRecords = pgTable(
  'personal_records',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    recordType: varchar('record_type', { length: 50 }).notNull(), // 'biggest_win', 'highest_multiplier', 'longest_session', 'best_rtp_day', 'fastest_redemption', 'most_bonuses_one_day'
    value: decimal('value', { precision: 14, scale: 2 }).notNull(),
    details: jsonb('details').notNull(), // game, platform, date, context
    achievedAt: timestamp('achieved_at').notNull(),
    previousRecord: decimal('previous_record', { precision: 14, scale: 2 }),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({ pk: primaryKey(t.userId, t.recordType) })
)
```

**Frontend:** Stats card component showing all personal records. Animation when a record is broken during a session. "NEW PERSONAL BEST!" notification. Shareable. Another viral screenshot feature.

---

# IMPLEMENTATION ORDER

Execute in this order. Each phase should be fully complete before moving to the next.

## Phase 1: SweepBot Flows Core (HIGHEST PRIORITY)

1. Flow Definition types and schema (the AST)
2. Database tables and Drizzle migrations
3. Rule-based NLP interpreter (entities, actions, conditions, schedules)
4. Responsible play validator (guardrails — non-negotiable)
5. Flow executor (runtime engine)
6. Scheduler (cron-based triggering)
7. Conversational flow builder (multi-turn chat)
8. API endpoints (all CRUD + interpret + converse + execute)
9. Frontend: FlowChat, FlowsPage, FlowDetail, FlowConfirmation
10. LLM fallback integration for complex interpretations

## Phase 2: Analytics Expansion

11. Win/Loss Heatmaps (Feature 7)
12. Hot/Cold Streak Detection (Feature 3)
13. Session Replay Summaries (Feature 6)
14. Predictive Balance Modeling (Feature 8)
15. Personal Records Tracker (Feature 25)
16. Bonus Efficiency Score (Feature 5)

## Phase 3: Intelligence & Monitoring

17. Platform Health Monitor (Feature 4)
18. New Game Alert System (Feature 9)
19. Gold Coin Package Value Ranker (Feature 14)
20. Purchase Timing Optimizer (Feature 15)
21. New Platform Scout (Feature 19)
22. Regulatory Radar (Feature 22)

## Phase 4: Community & Engagement

23. Verified Big Win Board (Feature 10)
24. Achievement System (Feature 12)
25. Daily Challenges (Feature 18)
26. Crew System (Feature 11)
27. Game Tutorial Library (Feature 23)
28. Customer Support Scorecards (Feature 20)

## Phase 5: Monetization & Growth

29. Flow Marketplace (sharing + selling)
30. Affiliate Offer Comparator (Feature 21)
31. Smart Wagering Autopilot (Feature 1)
32. Year-in-Review Generator (Feature 13)
33. Weekly Market Report (Feature 24)
34. Daily Digest Briefing (Feature 2)

## Phase 6: Security & Compliance

35. Account Breach Monitor (Feature 16)
36. VPN Compliance Checker (Feature 17)

---

# CRITICAL REMINDERS

1. **Every feature feeds the data moat.** Every table, every tracked event, every user interaction is data that compounds over time and cannot be replicated by a competitor.

2. **Responsible play is non-negotiable.** Every feature that involves automation or betting MUST pass through responsible play validation. No exceptions. This is a core company value AND a legal/regulatory necessity.

3. **Production-grade code only.** Full TypeScript types. Zod validation on all inputs. Error handling on every async operation. Database transactions where needed. Rate limiting on all endpoints. Input sanitization everywhere.

4. **Subscription tier awareness.** Every feature should check the user's subscription tier and enforce limits accordingly. Free tier gets a taste. Pro tier gets the full experience. Elite gets the premium extras.

5. **The browser extension is the data collection backbone.** Many of these features depend on session data captured by the extension. Ensure all new data requirements are reflected in the extension's tracking capabilities.

6. **Git commit after every major feature.** Descriptive commit messages. Branch per phase if possible.

7. **Test as you go.** At minimum, write integration tests for the Flow interpreter and executor. These are the most complex systems and the most critical to get right.

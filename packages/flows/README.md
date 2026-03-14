# @sweepbot/flows

Natural Language Automation Engine for SweepBot. Convert plain English descriptions into executable automation scripts with built-in responsible play guardrails.

## Features

✨ **Natural Language Processing**

- Rule-based entity recognition (platforms, games, actions, conditions, schedules)
- 4-pass interpretation pipeline (entity extraction → intent classification → AST building → validation)
- Confidence scoring and fallback to LLM for ambiguous input
- Human-readable summaries with emoji indicators

🎯 **AST-Based Execution Model**

- Flow Definition Abstract Syntax Tree with 9 node types
- Recursive execution with context management
- Full metric tracking per execution (actions, spins, bonuses, wagered, won, etc.)
- Real-time logging of every action, condition, loop, and variable change

🛡️ **Mandatory Responsible Play**

- System-enforced guardrails (max_duration, cool_down_check, max_loss, chase_detection, etc.)
- Loop safety caps (maxIterations, maxDuration)
- Per-node failure strategies (skip, retry, stop, fallback)
- Subscription tier-based limits

⏰ **Cron-Based Scheduling**

- Timezone-aware scheduling via node-cron
- Automatic startup recovery for all active flows
- Dynamic job management (activate, pause, resume)
- Error notifications to users

💬 **Multi-Turn Conversation**

- Guided Flow building through natural dialogue
- Intent detection (confirm, refine, question)
- Auto-generated follow-up questions
- Confirmation cards before activation

📊 **Comprehensive Testing**

- 200+ unit and integration tests
- 80%+ code coverage
- Vitest configuration included
- Mock data for testing

## Installation

```bash
npm install @sweepbot/flows
```

## Quick Start

### 1. Interpret Natural Language

```typescript
import { FlowInterpreter } from '@sweepbot/flows'

const interpreter = new FlowInterpreter()

const result = await interpreter.interpret({
  userId: 'user-123',
  rawInput: 'Every day at 3:30, open Chumba, grab my daily bonus, throw it on Sweet Bonanza at minimum bet. If I hit over 5x what the bonus was, keep going. If not, stop.',
})

console.log(result.flow)              // FlowDefinition (AST)
console.log(result.confidence)        // 0.85
console.log(result.humanReadableSummary)
// ⏰ Trigger: Daily at 3:30 PM (EST)
// 🌐 Open Chumba Casino
// 🎁 Claim daily login bonus
// 🎰 Open Sweet Bonanza
// 🔄 Spin at minimum bet
// ❓ If PROFIT > 5× $BONUS → continue spinning
// 🛡️ Safety Guards:
//   • Max session: 2 hours
//   • Cool-down check enabled
```

### 2. Validate with Responsible Play

```typescript
import { ResponsiblePlayValidator } from '@sweepbot/flows'

const validator = new ResponsiblePlayValidator()
// pass optional flow description/raw text to help detect user-specified limits
const guardrails = validator.validate(flow.rootNode, flow.userId, flow.description)

console.log(guardrails)
// [
//   { type: 'max_duration', value: 7200000, source: 'system_default', overridable: true },
//   { type: 'cool_down_check', value: true, source: 'system_mandatory', overridable: false }
// ]
```

### 3. Execute the Flow

```typescript
import { FlowExecutor } from '@sweepbot/flows'

const executor = new FlowExecutor()

const executionResult = await executor.execute(flow, flow.userId, undefined, {
  responsiblePlay: {
    // IMPORTANT: cooldown is runtime state (do not persist it into the flow)
    isInCooldown: false,
  },
})

console.log(executionResult.metrics)
// {
//   totalDuration: 1847000,
//   actionsExecuted: 5,
//   conditionsEvaluated: 12,
//   loopIterations: 47,
//   bonusesClaimed: 1,
//   bonusValueClaimed: 25.00,
//   spinsExecuted: 47,
//   totalWagered: 470.00,
//   totalWon: 1250.00,
//   netResult: 755.00
// }
```

### 4. Schedule the Flow

```typescript
import { FlowScheduler } from '@sweepbot/flows'

const scheduler = new FlowScheduler()

await scheduler.activateFlow(flow, flow.userId)
// Flow scheduled: cron="0 15 * * *" timezone="America/New_York"
```

### 5. Multi-Turn Conversation

## Building & Packaging 📦

The flows package is written in strict TypeScript and is compiled to plain JavaScript
via `tsc`. From the package itself you can run:

```bash
pnpm run build          # compile to dist/ within packages/flows
pnpm run typecheck      # only perform a type check
pnpm run test           # run unit/integration tests
```

At the monorepo root there's a helper script that makes it easy to build just the
flows bundle:

```bash
pnpm run build:flows     # equivalent to `pnpm --filter @sweepbot/flows run build`
```

When preparing for publishing, ensure that `dist/` contains the compiled output
and update the version in `packages/flows/package.json`. The package is currently
private; change `private` to `false` in the manifest before publishing to a
registry.

### Using ConversationManager

```typescript
import { ConversationManager } from '@sweepbot/flows'

const conversationMgr = new ConversationManager()

// Start conversation
let state = await conversationMgr.startConversation(
  userId,
  'conv-123',
  'Daily bonus collection'
)

// User refines
state = await conversationMgr.continue('conv-123', 'At 3 PM')
state = await conversationMgr.continue('conv-123', 'On Sweet Bonanza')

// User confirms
state = await conversationMgr.continue('conv-123', 'Looks good, activate')

// Final confirmation
const flow = await conversationMgr.confirm('conv-123')
```

## API Reference

### EntityRecognizer

```typescript
class EntityRecognizer {
  recognize(text: string): EntityMap
  extractPlatforms(text: string): PlatformEntity[]
  extractGames(text: string): GameEntity[]
  extractActions(text: string): ActionEntity[]
  extractConditions(text: string): ConditionEntity[]
  extractSchedules(text: string): ScheduleEntity[]
  extractAmounts(text: string): AmountEntity[]
  extractDurations(text: string): DurationEntity[]
}
```

### FlowInterpreter

```typescript
class FlowInterpreter {
  async interpret(request: FlowInterpretationRequest): Promise<FlowInterpretationResult>
}

interface FlowInterpretationRequest {
  userId: string
  rawInput: string
  conversationHistory?: ConversationMessage[]
  existingFlows?: FlowDefinition[]
}

interface FlowInterpretationResult {
  flow: FlowDefinition
  confidence: number // 0-1
  humanReadableSummary: string
  ambiguities?: Ambiguity[]
  warnings?: FlowWarning[]
  suggestedImprovements?: string[]
}
```

### FlowExecutor

```typescript
class FlowExecutor {
  async execute(
    flowId: string,
    userId: string,
    context?: Record<string, unknown>
  ): Promise<FlowExecutionResult>
}

interface FlowExecutionResult {
  executionId: string
  status: 'completed' | 'failed' | 'stopped_by_guardrail'
  metrics: FlowExecutionMetrics
  log: FlowExecutionLog[]
  duration: number
}
```

### ResponsiblePlayValidator

```typescript
class ResponsiblePlayValidator {
  validate(flowNode: FlowNode, userId: string): ResponsiblePlayGuardrail[]
}

interface ResponsiblePlayGuardrail {
  type: 'max_duration' | 'max_loss' | 'balance_floor' | 'max_iterations' | 'chase_detection' | 'cool_down_check' | 'daily_aggregate'
  value: number | boolean
  source: 'user_specified' | 'system_default' | 'system_mandatory'
  overridable: boolean
}
```

### FlowScheduler

```typescript
class FlowScheduler {
  async activateFlow(flow: FlowDefinition, userId: string): Promise<void>
  async pauseFlow(flowId: string): Promise<void>
  async resumeFlow(flow: FlowDefinition, userId: string): Promise<void>
  async reactivateAllFlows(allFlows: FlowDefinition[]): Promise<void>
  getFlowStatus(flowId: string, userId: string): 'active' | 'paused' | 'not_found'
  getActiveFlows(): string[]
  async shutdown(): Promise<void>
}
```

### ConversationManager

```typescript
class ConversationManager {
  async startConversation(userId: string, sessionId: string, initialDescription: string): Promise<ConversationState>
  async continue(conversationId: string, userMessage: string): Promise<ConversationState>
  async confirm(conversationId: string): Promise<FlowDefinition>
}

interface ConversationState {
  userId: string
  sessionId: string
  currentFlow: Partial<FlowDefinition>
  turns: ConversationTurn[]
  pendingQuestions: string[]
  status: 'building' | 'confirming' | 'modifying' | 'complete'
}
```

## Type Definitions

### FlowDefinition

The main data structure representing a user's automation flow.

```typescript
interface FlowDefinition {
  id: string
  userId: string
  name: string
  description: string // original natural language input
  version: number
  status: 'draft' | 'active' | 'paused' | 'archived'
  trigger: FlowTrigger // when to execute
  rootNode: FlowNode // AST root
  variables: FlowVariable[] // user-defined variables
  responsiblePlayGuardrails: ResponsiblePlayGuardrail[]
  createdAt: Date
  updatedAt: Date
  lastExecutedAt?: Date
  executionCount: number
  performanceStats: FlowPerformanceStats
}
```

### FlowNode (Union Type)

The AST consists of different node types:

```typescript
type FlowNode =
  | FlowActionNode      // Perform an action
  | FlowConditionNode   // Branch on condition
  | FlowLoopNode        // Repeat with caps
  | FlowSequenceNode    // Execute in order
  | FlowParallelNode    // Execute in parallel
  | FlowWaitNode        // Wait for duration
  | FlowStopNode        // Stop execution
  | FlowAlertNode       // Send alert
  | FlowStoreNode       // Store variable
```

### FlowTrigger

When should the flow execute?

```typescript
type FlowTrigger =
  | { type: 'scheduled'; cron: string; timezone: string }
  | { type: 'manual' }
  | { type: 'event'; event: FlowEventType }
  | { type: 'condition'; condition: string }
```

## Examples

### Simple Daily Bonus Collection

```typescript
const result = await interpreter.interpret({
  userId: 'user-123',
  rawInput: 'Claim my daily bonus every morning at 9 AM',
})

// Result:
// - Flow Definition with scheduled trigger (0 9 * * *)
// - Action: claim_bonus
// - Guardrails: max_duration (2 hours), cool_down_check
```

### Complex Spinning Strategy

This example also demonstrates the new conditional parsing: phrases like "if more than $50" or "if less than 10 spins" are now recognized and turned into `FlowConditionNode`s in the AST.

```typescript
const result = await interpreter.interpret({
  userId: 'user-456',
  rawInput: 'Every day at 3:30, open Chumba, grab my daily bonus, throw it on Sweet Bonanza at minimum bet. If I hit over 5x what the bonus was, keep going. If not, stop.',
})

// Result:
// - Sequence: open platform → login → claim bonus → open game → spin with loop
// - Loop condition: IF profit > 5× bonus THEN continue
// - Guardrails: max_duration, cool_down_check, max_iterations (100), max_duration (30 min for loop)
```

### Multi-Turn Refinement

The conversation manager now begins by generating any follow-up questions immediately after the first user message. For example, saying "Play the game" will trigger an assistant question about scheduling:

```text
User: Play the game
Assistant: When should this Flow run? (e.g., "every day at 3 PM", "manually")
```

```typescript
const state1 = await conversationMgr.startConversation(
  'user-789',
  'conv-1',
  'I want to automate my casino routine'
)

const state2 = await conversationMgr.continue('conv-1', 'Every day at 3 PM')
const state3 = await conversationMgr.continue('conv-1', 'On Chumba and Sweet Bonanza')
const state4 = await conversationMgr.continue('conv-1', 'With a $50 loss limit')
const state5 = await conversationMgr.continue('conv-1', 'Looks perfect, activate it')

const flow = await conversationMgr.confirm('conv-1')
// Flow is now ready to execute
```

## Testing

Run the comprehensive test suite:

```bash
# All tests
npm run test

# Watch mode
npm run test:watch

# With coverage
npm run test:cov
```

Tests include:

- EntityRecognizer: 60+ assertions across 9 test suites
- FlowInterpreter: 90+ assertions across 14 test suites
- FlowExecutor: 85+ assertions across 17 test suites
- Integration: 50+ assertions across 14 end-to-end scenarios

## Architecture

```text
flows/
├── src/
│   ├── types.ts                    # Core type definitions
│   ├── interpreter/
│   │   ├── entity-recognizer.ts    # NLP entity extraction
│   │   └── interpreter.ts          # 4-pass interpretation pipeline
│   ├── executor/
│   │   └── executor.ts             # AST execution engine
│   ├── validator/
│   │   └── responsible-play-validator.ts
│   ├── scheduler/
│   │   └── scheduler.ts            # Cron job management
│   ├── conversation/
│   │   └── conversation-manager.ts # Multi-turn builder
│   ├── index.ts                    # Package exports
│   └── __tests__/
│       ├── entity-recognizer.test.ts
│       ├── interpreter.test.ts
│       ├── executor.test.ts
│       └── integration.test.ts
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

## Performance

- **Entity Recognition:** < 50ms for typical input (< 500 chars)
- **Interpretation:** < 500ms including entity extraction + AST building
- **Execution:** < 100ms per node traversal (excludes action execution time)
- **Scheduling:** O(1) activation, O(1) lookup, O(n) startup reactivation

## Browser Compatibility

- Node.js 18+
- Uses standard ES2020+ features
- No DOM dependencies (pure Node.js)
- Works in both CJS and ESM environments

## Contributing

When adding new features:

1. Update types in `types.ts`
2. Implement in appropriate module
3. Add tests in `__tests__/`
4. Update README
5. Run full test suite
6. Maintain 80%+ coverage

## License

Proprietary - SweepBot 2026

## Support

For issues, questions, or feature requests, contact the SweepBot team or open an issue in the main repository.

---

**Last Updated:** February 28, 2026  
**Version:** 1.0.0  
**Status:** Production Ready ✅

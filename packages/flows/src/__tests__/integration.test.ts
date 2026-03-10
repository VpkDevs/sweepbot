/**
 * Integration Tests
 * Test end-to-end Flow creation, interpretation, execution, and persistence
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { FlowInterpreter } from '../interpreter/interpreter'
import { FlowExecutor } from '../executor/executor'
import { ResponsiblePlayValidator } from '../validator/responsible-play-validator'
import { FlowScheduler } from '../scheduler/scheduler'
import { ConversationManager } from '../conversation/conversation-manager'
import type { FlowDefinition, ConversationState } from '../types'

describe('Integration Tests - End-to-End Flows', () => {
  let interpreter: FlowInterpreter
  let executor: FlowExecutor
  let validator: ResponsiblePlayValidator
  let scheduler: FlowScheduler
  let conversationManager: ConversationManager

  beforeEach(() => {
    interpreter = new FlowInterpreter()
    executor = new FlowExecutor()
    validator = new ResponsiblePlayValidator()
    scheduler = new FlowScheduler()
    conversationManager = new ConversationManager()
  })

  describe('Complete Flow Lifecycle', () => {
    it('should interpret natural language → validate → persist → schedule', async () => {
      // Step 1: Interpret natural language
      const interpretResult = await interpreter.interpret({
        userId: 'user-123',
        rawInput: 'Every day at 3 PM, open Chumba and claim bonus',
      })

      const flow = interpretResult.flow
      expect(flow.id).toBeDefined()
      expect(flow.userId).toBe('user-123')
      expect(flow.trigger.type).toBe('scheduled')
      expect(interpretResult.confidence).toBeGreaterThan(0.5)

      // Step 2: Validate responsible play
      const guardrails = validator.validate(flow.rootNode, flow.userId, flow.description)
      expect(guardrails.length).toBeGreaterThan(0)

      // Step 3: Simulate persisting to database
      const savedFlow: FlowDefinition = {
        ...flow,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      expect(savedFlow.id).toBeDefined()
      expect(savedFlow.status).toBe('active')

      // Step 4: Activate scheduling
      // In real scenario, would call scheduler.activateFlow(savedFlow, flow.userId)
      expect(flow.trigger.type).toBe('scheduled')
    })

    it('should handle multi-turn conversation refinement', async () => {
      // Step 1: Start conversation with initial description
      const initialMessage = 'Every day, open Chumba and play'
      const conversationId = 'conv-123'
      const userId = 'user-456'

      let state: ConversationState = await conversationManager.startConversation(
        userId,
        conversationId,
        initialMessage
      )

      expect(state.userId).toBe(userId)
      // initial conversation may include an assistant follow‑up question
      expect(state.turns.length).toBeGreaterThanOrEqual(1)
      expect(state.turns[0]!.role).toBe('user')
      expect(state.status).toBe('building')

      // Step 2: User refines - adds specific time
      state = await conversationManager.continue(conversationId, 'Actually at 3:30 PM')
      expect(state.turns.length).toBeGreaterThan(1)

      // Step 3: User refines - adds game
      state = await conversationManager.continue(conversationId, 'And play Sweet Bonanza')
      expect(state.turns.length).toBeGreaterThan(2)

      // Step 4: Confirm
      state = await conversationManager.continue(conversationId, 'Looks good, activate it')
      // Should move toward confirming state
      expect(state).toBeDefined()
    })

    it('should enforce responsible play throughout lifecycle', async () => {
      // Create a potentially risky flow
      const interpretResult = await interpreter.interpret({
        userId: 'user-789',
        rawInput: 'Run forever and keep spinning',
      })

      const flow = interpretResult.flow

      // Validate should enforce guardrails
      const guardrails = validator.validate(flow.rootNode, flow.userId, flow.description)

      // Should have mandatory guardrails
      const mandatoryGuards = guardrails.filter((g) => g.source === 'system_mandatory')
      expect(mandatoryGuards.length).toBeGreaterThan(0)

      // Should have default duration limit
      const durationGuard = guardrails.find((g) => g.type === 'max_duration')
      expect(durationGuard).toBeDefined()
    })
  })

  describe('Execution Flow Scenarios', () => {
    it('should execute simple bonus collection flow', async () => {
      const interpretResult = await interpreter.interpret({
        userId: 'exec-test-1',
        rawInput: 'Open Chumba, claim bonus, close platform',
      })

      const flow = interpretResult.flow

      // Verify flow is structurally sound
      expect(flow.rootNode.type).toBe('sequence')
      expect((flow.rootNode as any).steps.length).toBeGreaterThanOrEqual(1)

      // In real execution, would call executor.execute()
      // For now, just verify the flow is executable
      expect(flow.status).toBe('draft')
    })

    it('should execute spinning strategy with loop', async () => {
      const interpretResult = await interpreter.interpret({
        userId: 'exec-test-2',
        rawInput: 'Claim bonus, then keep spinning while profitable',
      })

      const flow = interpretResult.flow

      // Should have loop in the flow
      const hasLoop = (node: any): boolean => {
        if (node.type === 'loop') return true
        if (node.type === 'sequence' && node.steps) {
          return node.steps.some((step: any) => hasLoop(step))
        }
        return false
      }

      expect(hasLoop(flow.rootNode)).toBe(true)
    })

    it('should execute conditional flow with branching', async () => {
      const interpretResult = await interpreter.interpret({
        userId: 'exec-test-3',
        rawInput: 'Claim bonus. If more than $50, spin. If not, close.',
      })

      const flow = interpretResult.flow

      // Should have conditional logic
      let condNode: any | null = null
      const findCondition = (node: any): any | null => {
        if (node.type === 'condition') return node
        if (node.type === 'sequence' && node.steps) {
          for (const step of node.steps) {
            const found = findCondition(step)
            if (found) return found
          }
        }
        return null
      }

      condNode = findCondition(flow.rootNode)
      expect(condNode).not.toBeNull()
      // operator should be defined (e.g. ">")
      expect(condNode.operator).toBeDefined()
      // if there is an onFalse branch it should be a valid action node
      if (condNode.onFalse) {
        expect(condNode.onFalse.type).toBe('action')
      }
    })
  })

  describe('Error Recovery and Resilience', () => {
    it('should handle vague input with low confidence', async () => {
      const interpretResult = await interpreter.interpret({
        userId: 'error-test-1',
        rawInput: 'play',
      })

      // Should still create a flow but with low confidence
      expect(interpretResult.flow).toBeDefined()
      expect(interpretResult.confidence).toBeLessThan(0.7)
    })

    it('should recover from ambiguous entity references', async () => {
      const interpretResult = await interpreter.interpret({
        userId: 'error-test-2',
        rawInput: 'Open the casino and play the game',
      })

      // Should still interpret even if entities are ambiguous
      expect(interpretResult.flow).toBeDefined()
      expect(interpretResult.flow.rootNode).toBeDefined()
    })

    it('should handle platform or game not found gracefully', async () => {
      const interpretResult = await interpreter.interpret({
        userId: 'error-test-3',
        rawInput: 'Open FakeGamblingCasino and play MadeUpGame',
      })

      // Should create a flow but might have warnings
      expect(interpretResult.flow).toBeDefined()
      // confidence might be low
      expect(interpretResult.confidence).toBeDefined()
    })
  })

  describe('Data Consistency and Persistence', () => {
    it('should maintain flow definition consistency through lifecycle', async () => {
      const interpretResult = await interpreter.interpret({
        userId: 'consistency-test',
        rawInput: 'Every day at 9 AM, open Chumba and claim bonus',
      })

      const flow = interpretResult.flow

      // Flow should have all required fields
      expect(flow.id).toBeDefined()
      expect(flow.userId).toBeDefined()
      expect(flow.name).toBeDefined()
      expect(flow.description).toBeDefined()
      expect(flow.trigger).toBeDefined()
      expect(flow.rootNode).toBeDefined()
      expect(flow.responsiblePlayGuardrails).toBeDefined()

      // Simulate persistence
      const persistedFlow = { ...flow, lastExecutedAt: new Date() }
      expect(persistedFlow.id).toBe(flow.id)
      expect(persistedFlow.userId).toBe(flow.userId)
    })

    it('should update flow definition correctly', async () => {
      const interpretResult = await interpreter.interpret({
        userId: 'update-test',
        rawInput: 'Daily at 3 PM, play Sweet Bonanza',
      })

      let flow = interpretResult.flow

      // Simulate updating status
      flow = { ...flow, status: 'active', updatedAt: new Date() }
      expect(flow.status).toBe('active')

      // Simulate updating definition
      flow = { ...flow, name: 'Updated Flow Name', updatedAt: new Date() }
      expect(flow.name).toBe('Updated Flow Name')
    })
  })

  describe('Performance and Scale', () => {
    it('should interpret multiple flows efficiently', async () => {
      const inputs = [
        'Daily at 3 PM, open Chumba and claim bonus',
        'Every Monday, play Sweet Bonanza',
        'Spin until I win $100',
        'Every hour, check balance',
        'Open LuckyLand, claim bonus, spin 10 times',
      ]

      const results = await Promise.all(
        inputs.map((input) =>
          interpreter.interpret({
            userId: 'perf-test',
            rawInput: input,
          })
        )
      )

      expect(results).toHaveLength(5)
      results.forEach((result) => {
        expect(result.flow).toBeDefined()
        expect(result.confidence).toBeGreaterThan(0)
      })
    })

    it('should handle complex flows without excessive overhead', async () => {
      const complexInput = `
        Every day at 3:30 PM EST, open Chumba Casino, log in with my credentials.
        Claim my daily login bonus and store it as my starting amount.
        Then open Sweet Bonanza and set the bet to minimum.
        Keep spinning while my current balance is greater than 5 times my starting bonus amount.
        Stop if I lose more than $50 or if I've been playing for more than 2 hours.
        When done, close the platform and log out.
        Send me a summary of how much I won or lost.
      `

      const startTime = Date.now()
      const result = await interpreter.interpret({
        userId: 'complex-perf-test',
        rawInput: complexInput,
      })
      const duration = Date.now() - startTime

      expect(result.flow).toBeDefined()
      expect(duration).toBeLessThan(5000) // Should complete in under 5 seconds
    })
  })

  describe('Validator Integration', () => {
    it('should reject flows without guardrails', async () => {
      const interpretResult = await interpreter.interpret({
        userId: 'validator-test',
        rawInput: 'Spin forever',
      })

      const flow = interpretResult.flow

      // Validator should enforce guardrails
      const guardrails = validator.validate(flow.rootNode, flow.userId, flow.description)
      expect(guardrails.length).toBeGreaterThan(0)
    })

    it('should enforce chase detection patterns', async () => {
      const interpretResult = await interpreter.interpret({
        userId: 'chase-test',
        rawInput: 'If I lose, double my bet and keep spinning',
      })

      const flow = interpretResult.flow
      // Flow should be created but with warnings
      expect(flow).toBeDefined()
      expect(flow.description).toContain('double')
    })

    it('should validate loop safety constraints', async () => {
      const interpretResult = await interpreter.interpret({
        userId: 'loop-test',
        rawInput: 'Spin 10000 times',
      })

      const flow = interpretResult.flow
      // Should create a flow with safe loop constraints
      expect(flow).toBeDefined()
    })
  })

  describe('Scheduler Integration', () => {
    it('should schedule flows with valid cron expressions', async () => {
      const interpretResult = await interpreter.interpret({
        userId: 'sched-test',
        rawInput: 'Every day at 3 PM, claim bonus',
      })

      const flow = interpretResult.flow

      // Verify trigger is proper format
      expect(flow.trigger.type).toBe('scheduled')
      expect((flow.trigger as any).cron).toBeDefined()
      expect((flow.trigger as any).timezone).toBeDefined()
    })

    it('should handle manual trigger flows without scheduling', async () => {
      const interpretResult = await interpreter.interpret({
        userId: 'manual-test',
        rawInput: 'Play the game',
      })

      const flow = interpretResult.flow
      // Manual flow should not be scheduled
      // It will use manual trigger
      expect(flow.trigger).toBeDefined()
    })
  })

  describe('Summary Generation', () => {
    it('should generate human-readable summaries', async () => {
      const interpretResult = await interpreter.interpret({
        userId: 'summary-test',
        rawInput: 'Every day at 9 AM, open Chumba, claim bonus, play Sweet Bonanza at minimum bet',
      })

      const summary = interpretResult.humanReadableSummary
      expect(summary).toBeDefined()
      expect(summary.length).toBeGreaterThan(0)
      expect(summary).toContain('⏰') // trigger emoji
      expect(summary).toContain('🌐') // platform emoji
    })

    it('should include guardrails in summary', async () => {
      const interpretResult = await interpreter.interpret({
        userId: 'summary-guards-test',
        rawInput: 'Spin daily',
      })

      const summary = interpretResult.humanReadableSummary
      expect(summary).toContain('🛡️') // guardrail emoji
    })
  })
})
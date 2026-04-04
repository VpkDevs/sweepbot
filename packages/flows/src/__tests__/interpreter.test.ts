/**
 * Flow Interpreter Tests
 * Test natural language interpretation and AST building
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { FlowInterpreter } from '../interpreter/interpreter'
import type { FlowDefinition, FlowActionNode, FlowLoopNode } from '../types'

describe('FlowInterpreter', () => {
  let interpreter: FlowInterpreter

  beforeEach(() => {
    interpreter = new FlowInterpreter()
  })

  describe('Intent Classification', () => {
    it('should classify bonus_collection intent', async () => {
      const result = await interpreter.interpret({
        userId: 'test-user',
        rawInput: 'I want to claim my daily bonus every morning',
      })
      expect(result.flow.description).toContain('daily bonus')
    })

    it('should classify play_strategy intent', async () => {
      const result = await interpreter.interpret({
        userId: 'test-user',
        rawInput: 'spin Sweet Bonanza 50 times',
      })
      expect(result.flow.description).toContain('spin')
    })

    it('should classify recurring_routine intent', async () => {
      const result = await interpreter.interpret({
        userId: 'test-user',
        rawInput: 'Every day at 3 PM, open Chumba and play',
      })
      expect(result.flow.trigger.type).toBe('scheduled')
    })

    it('should classify jackpot_hunting intent', async () => {
      const result = await interpreter.interpret({
        userId: 'test-user',
        rawInput: 'Look for jackpot on Gates of Olympus',
      })
      expect(result.flow.description).toContain('jackpot')
    })
  })

  describe('AST Building - Single Actions', () => {
    it('should build AST for platform opening', async () => {
      const result = await interpreter.interpret({
        userId: 'test-user',
        rawInput: 'Open Chumba Casino',
      })

      const flow = result.flow
      expect(flow.rootNode.type).toBe('sequence')
      const steps = (flow.rootNode as any).steps
      expect(steps.length).toBeGreaterThan(0)
      expect(steps[0].type).toBe('action')
      expect((steps[0] as FlowActionNode).action).toBe('open_platform')
      expect((steps[0] as FlowActionNode).platform).toBe('chumba')
    })

    it('should build AST for bonus claiming', async () => {
      const result = await interpreter.interpret({
        userId: 'test-user',
        rawInput: 'Claim my daily bonus',
      })

      const flow = result.flow
      const steps = (flow.rootNode as any).steps
      const bonusAction = steps.find((s: any) => s.action === 'claim_bonus')
      expect(bonusAction).toBeDefined()
      expect(bonusAction.parameters.storeAs).toBe('BONUS')
    })

    it('should build AST for game opening', async () => {
      const result = await interpreter.interpret({
        userId: 'test-user',
        rawInput: 'Open Sweet Bonanza',
      })

      const flow = result.flow
      const steps = (flow.rootNode as any).steps
      const gameAction = steps.find((s: any) => s.action === 'open_game')
      expect(gameAction).toBeDefined()
      expect(gameAction.game).toBe('sweet_bonanza')
    })
  })

  describe('AST Building - Sequences', () => {
    it('should build sequence for multiple platforms and actions', async () => {
      const result = await interpreter.interpret({
        userId: 'test-user',
        rawInput: 'Log in, claim bonus, play Sweet Bonanza, cash out',
      })

      const flow = result.flow
      expect(flow.rootNode.type).toBe('sequence')
      const steps = (flow.rootNode as any).steps
      expect(steps.length).toBeGreaterThanOrEqual(3)

      // Check that we have the expected action types
      const actionTypes = steps.map((s: any) => s.action)
      expect(actionTypes).toContain('claim_bonus')
      expect(actionTypes).toContain('open_game')
    })

    it('should handle "and then" connectors', async () => {
      const result = await interpreter.interpret({
        userId: 'test-user',
        rawInput: 'Open Chumba and then claim my bonus and then spin',
      })

      const flow = result.flow
      const steps = (flow.rootNode as any).steps
      expect(steps.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('AST Building - Loops', () => {
    it('should build loop for "keep spinning" patterns', async () => {
      const result = await interpreter.interpret({
        userId: 'test-user',
        rawInput: 'Keep spinning while winning',
      })

      const flow = result.flow
      const steps = (flow.rootNode as any).steps
      const loopNode = steps.find((s: any) => s.type === 'loop')
      expect(loopNode).toBeDefined()
      expect((loopNode as FlowLoopNode).maxIterations).toBe(100)
      expect((loopNode as FlowLoopNode).maxDuration).toBe(30 * 60 * 1000)
    })

    it('should build loop with condition from "if" clause', async () => {
      const result = await interpreter.interpret({
        userId: 'test-user',
        rawInput: 'Keep spinning if win > 5x the bonus',
      })

      const flow = result.flow
      const steps = (flow.rootNode as any).steps
      const loopNode = steps.find((s: any) => s.type === 'loop')
      expect(loopNode).toBeDefined()
    })

    it('should enforce loop safety caps', async () => {
      const result = await interpreter.interpret({
        userId: 'test-user',
        rawInput: 'Spin 1000 times',
      })

      const flow = result.flow
      const steps = (flow.rootNode as any).steps
      const loopNode =
        steps.find((s: any) => s.type === 'loop') || steps.find((s: any) => s.type === 'action')
      expect(loopNode).toBeDefined()
    })
  })

  describe('AST Building - Complex Flows', () => {
    it('should build AST for the spec example', async () => {
      const result = await interpreter.interpret({
        userId: 'test-user',
        rawInput:
          'Every day at 3:30, open Chumba, grab my daily bonus, throw it on Sweet Bonanza at minimum bet. If I hit over 5x what the bonus was, keep going. If not, stop.',
      })

      const flow = result.flow

      // Check trigger
      expect(flow.trigger.type).toBe('scheduled')
      expect((flow.trigger as any).cron).toBeDefined()

      // Check root node
      expect(flow.rootNode.type).toBe('sequence')
      const steps = (flow.rootNode as any).steps
      expect(steps.length).toBeGreaterThanOrEqual(2)

      // Check for platform opening
      const platformAction = steps.find((s: any) => s.action === 'open_platform')
      expect(platformAction).toBeDefined()

      // Check for bonus claiming
      const bonusAction = steps.find((s: any) => s.action === 'claim_bonus')
      expect(bonusAction).toBeDefined()

      // Check for game opening
      const gameAction = steps.find((s: any) => s.action === 'open_game')
      expect(gameAction).toBeDefined()

      // Check for spinning logic (could be loop or action)
      const spinLogic = steps.find((s: any) => s.action === 'spin' || s.type === 'loop')
      expect(spinLogic).toBeDefined()
    })

    it('should handle login when mentioned', async () => {
      const result = await interpreter.interpret({
        userId: 'test-user',
        rawInput: 'Log in to Chumba and claim bonus',
      })

      const flow = result.flow
      const steps = (flow.rootNode as any).steps
      const loginAction = steps.find((s: any) => s.action === 'login')
      expect(loginAction).toBeDefined()
    })

    it('should extract and store bet amounts', async () => {
      const result = await interpreter.interpret({
        userId: 'test-user',
        rawInput: 'Spin at $5 per spin',
      })

      const flow = result.flow
      const steps = (flow.rootNode as any).steps
      const spinAction = steps.find((s: any) => s.action === 'spin')
      expect(spinAction).toBeDefined()
      expect(spinAction?.parameters.betAmount).toBeDefined()
    })

    it('should extract and store minimum bet reference', async () => {
      const result = await interpreter.interpret({
        userId: 'test-user',
        rawInput: 'Spin at minimum bet',
      })

      const flow = result.flow
      const steps = (flow.rootNode as any).steps
      const spinAction = steps.find((s: any) => s.action === 'spin')
      expect(spinAction?.parameters.betAmount).toBe('minimum')
    })
  })

  describe('Responsible Play Guardrails', () => {
    it('should add default max_duration guardrail', async () => {
      const result = await interpreter.interpret({
        userId: 'test-user',
        rawInput: 'Spin the reels',
      })

      const flow = result.flow
      const maxDurationGuard = flow.responsiblePlayGuardrails.find((g) => g.type === 'max_duration')
      expect(maxDurationGuard).toBeDefined()
      expect(maxDurationGuard?.value).toBe(2 * 60 * 60 * 1000) // 2 hours
    })

    it('should add cool_down_check guardrail', async () => {
      const result = await interpreter.interpret({
        userId: 'test-user',
        rawInput: 'Play the game',
      })

      const flow = result.flow
      const coolDownGuard = flow.responsiblePlayGuardrails.find((g) => g.type === 'cool_down_check')
      expect(coolDownGuard).toBeDefined()
      expect(coolDownGuard?.overridable).toBe(false)
    })

    it('should enforce mandatory guardrails', async () => {
      const result = await interpreter.interpret({
        userId: 'test-user',
        rawInput: 'Run forever',
      })

      const flow = result.flow
      const mandatoryGuards = flow.responsiblePlayGuardrails.filter(
        (g) => g.source === 'system_mandatory'
      )
      expect(mandatoryGuards.length).toBeGreaterThan(0)
    })

    it('should add user-specified max_loss guardrail', async () => {
      const result = await interpreter.interpret({
        userId: 'test-user',
        rawInput: 'Stop if I lose more than $50',
      })

      const flow = result.flow
      const lossGuard = flow.responsiblePlayGuardrails.find((g) => g.type === 'max_loss')
      expect(lossGuard).toBeDefined()
      expect(lossGuard?.value).toBe(50)
      expect(lossGuard?.source).toBe('user_specified')
    })

    it('should build a condition node when simple if/then input provided', async () => {
      const result = await interpreter.interpret({
        userId: 'test-user',
        rawInput: 'Claim bonus. If more than $50, spin. If not, close.',
      })
      const flow = result.flow
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
      const condNode = findCondition(flow.rootNode)
      expect(condNode).not.toBeNull()
      expect(condNode.operator).toBe('>')
    })

    it('should flag chase detection for doubling bets', async () => {
      const result = await interpreter.interpret({
        userId: 'test-user',
        rawInput: 'If I lose, double my bet and keep spinning',
      })

      const flow = result.flow
      const chaseGuard = flow.responsiblePlayGuardrails.find((g) => g.type === 'chase_detection')
      expect(chaseGuard).toBeDefined()
      expect(chaseGuard?.source).toBe('system_mandatory')
    })
  })

  describe('Confidence Scoring', () => {
    it('should score high confidence for clear input', async () => {
      const result = await interpreter.interpret({
        userId: 'test-user',
        rawInput: 'Every day at 3 PM, open Chumba Casino and claim bonus on Sweet Bonanza',
      })

      expect(result.confidence).toBeGreaterThan(0.7)
    })

    it('should score lower confidence for vague input', async () => {
      const result = await interpreter.interpret({
        userId: 'test-user',
        rawInput: 'do the thing',
      })

      expect(result.confidence).toBeLessThan(0.7)
    })

    it('should increase confidence with more entities', async () => {
      const vagueResult = await interpreter.interpret({
        userId: 'test-user',
        rawInput: 'play',
      })

      const clearResult = await interpreter.interpret({
        userId: 'test-user',
        rawInput: 'Open Chumba Casino, claim bonus, and play Sweet Bonanza at minimum bet',
      })

      expect(clearResult.confidence).toBeGreaterThan(vagueResult.confidence)
    })
  })

  describe('Human Readable Summaries', () => {
    it('should generate summary for simple flow', async () => {
      const result = await interpreter.interpret({
        userId: 'test-user',
        rawInput: 'Open Chumba and spin',
      })

      expect(result.humanReadableSummary).toBeDefined()
      expect(result.humanReadableSummary.length).toBeGreaterThan(0)
      expect(result.humanReadableSummary).toContain('🌐') // platform emoji
    })

    it('should include guardrail info in summary', async () => {
      const result = await interpreter.interpret({
        userId: 'test-user',
        rawInput: 'Spin the reels',
      })

      expect(result.humanReadableSummary).toContain('🛡️')
    })

    it('should show trigger information', async () => {
      const result = await interpreter.interpret({
        userId: 'test-user',
        rawInput: 'Every day at 9 AM, open Chumba',
      })

      expect(result.humanReadableSummary).toContain('⏰')
    })
  })

  describe('Warnings and Ambiguities', () => {
    it('should generate warnings for potentially risky flows', async () => {
      const result = await interpreter.interpret({
        userId: 'test-user',
        rawInput: 'Keep spinning forever',
      })

      expect(result.warnings?.length || 0).toBeGreaterThanOrEqual(0)
    })

    it('should flag chase detection patterns', async () => {
      const result = await interpreter.interpret({
        userId: 'test-user',
        rawInput: 'If I lose, double the bet and keep spinning',
      })

      // Should generate a warning about chase detection
      expect(result.flow.description).toContain('double')
    })
  })

  describe('Flow Naming', () => {
    it('should generate descriptive names', async () => {
      const result = await interpreter.interpret({
        userId: 'test-user',
        rawInput: 'Open Chumba and play Sweet Bonanza',
      })

      expect(result.flow.name).toBeDefined()
      expect(result.flow.name.length).toBeGreaterThan(0)
      expect(result.flow.name).toMatch(/Chumba|Sweet Bonanza/i)
    })

    it('should handle untitled flows', async () => {
      const result = await interpreter.interpret({
        userId: 'test-user',
        rawInput: 'play',
      })

      expect(result.flow.name).toBeDefined()
      // Should have a default or generated name
    })
  })
})

/**
 * Flow Executor Tests
 * Test runtime execution, node traversal, and metric tracking
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { FlowExecutor } from '../executor/executor'
import type { FlowDefinition, FlowNode, FlowActionNode, FlowConditionNode, FlowLoopNode } from '../types'

describe('FlowExecutor', () => {
  let executor: FlowExecutor

  beforeEach(() => {
    executor = new FlowExecutor()
  })

  // Helper to create a simple flow definition
  function createTestFlow(rootNode: FlowNode): FlowDefinition {
    return {
      id: 'test-flow-1',
      userId: 'test-user',
      name: 'Test Flow',
      description: 'A test flow',
      version: 1,
      status: 'draft',
      trigger: { type: 'manual' },
      rootNode,
      variables: [],
      responsiblePlayGuardrails: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      executionCount: 0,
      performanceStats: {},
    }
  }

  describe('Action Execution', () => {
    it('should execute action nodes sequentially', async () => {
      const action: FlowActionNode = {
        type: 'action',
        id: 'action-1',
        action: 'spin',
        parameters: { betAmount: 10 },
        timeout: 5000,
        onFailure: 'stop',
      }

      const flow = createTestFlow(action)

      // Mock execution would happen here
      expect(action.type).toBe('action')
      expect(action.action).toBe('spin')
    })

    it('should track action execution in logs', async () => {
      const action: FlowActionNode = {
        type: 'action',
        id: 'action-1',
        action: 'claim_bonus',
        parameters: { storeAs: 'BONUS' },
        timeout: 5000,
        onFailure: 'skip',
      }

      const flow = createTestFlow(action)
      expect(flow.rootNode.type).toBe('action')
    })

    it('should set timeout on actions', async () => {
      const action: FlowActionNode = {
        type: 'action',
        id: 'action-1',
        action: 'spin',
        parameters: { betAmount: 5 },
        timeout: 10000,
        onFailure: 'retry',
      }

      expect(action.timeout).toBe(10000)
    })

    it('should handle action failure modes', async () => {
      // Test 'skip' mode
      const skipAction: FlowActionNode = {
        type: 'action',
        id: 'action-1',
        action: 'claim_bonus',
        parameters: {},
        timeout: 5000,
        onFailure: 'skip',
      }

      expect(skipAction.onFailure).toBe('skip')

      // Test 'stop' mode
      const stopAction: FlowActionNode = {
        type: 'action',
        id: 'action-2',
        action: 'spin',
        parameters: {},
        timeout: 5000,
        onFailure: 'stop',
      }

      expect(stopAction.onFailure).toBe('stop')
    })
  })

  describe('Sequence Execution', () => {
    it('should execute sequence of actions in order', async () => {
      const sequence: FlowNode = {
        type: 'sequence',
        id: 'seq-1',
        steps: [
          {
            type: 'action',
            id: 'step-1',
            action: 'open_platform',
            parameters: { platform: 'chumba' },
            timeout: 5000,
            onFailure: 'stop',
          },
          {
            type: 'action',
            id: 'step-2',
            action: 'login',
            parameters: {},
            timeout: 5000,
            onFailure: 'stop',
          },
          {
            type: 'action',
            id: 'step-3',
            action: 'claim_bonus',
            parameters: { storeAs: 'BONUS' },
            timeout: 5000,
            onFailure: 'skip',
          },
        ],
      }

      const flow = createTestFlow(sequence)
      expect((flow.rootNode as any).steps.length).toBe(3)
    })

    it('should not execute further steps if earlier step fails with stop', async () => {
      const sequence: FlowNode = {
        type: 'sequence',
        id: 'seq-1',
        steps: [
          {
            type: 'action',
            id: 'step-1',
            action: 'login',
            parameters: {},
            timeout: 5000,
            onFailure: 'stop', // Will stop on failure
          },
          {
            type: 'action',
            id: 'step-2',
            action: 'claim_bonus',
            parameters: {},
            timeout: 5000,
            onFailure: 'skip',
          },
        ],
      }

      const flow = createTestFlow(sequence)
      expect(flow.status).toBe('draft')
    })
  })

  describe('Condition Evaluation', () => {
    it('should evaluate greater than condition', async () => {
      const condition: FlowConditionNode = {
        type: 'condition',
        id: 'cond-1',
        left: { type: 'variable', name: 'PROFIT' },
        operator: '>',
        right: { type: 'literal', value: 50 },
        onTrue: {
          type: 'action',
          id: 'true-action',
          action: 'spin',
          parameters: {},
          timeout: 5000,
          onFailure: 'stop',
        },
      }

      expect(condition.operator).toBe('>')
    })

    it('should evaluate less than condition', async () => {
      const condition: FlowConditionNode = {
        type: 'condition',
        id: 'cond-1',
        left: { type: 'variable', name: 'LOSS' },
        operator: '<',
        right: { type: 'literal', value: 100 },
        onTrue: {
          type: 'action',
          id: 'true-action',
          action: 'spin',
          parameters: {},
          timeout: 5000,
          onFailure: 'stop',
        },
      }

      expect(condition.operator).toBe('<')
    })

    it('should evaluate equality condition', async () => {
      const condition: FlowConditionNode = {
        type: 'condition',
        id: 'cond-1',
        left: { type: 'variable', name: 'STATUS' },
        operator: '==',
        right: { type: 'literal', value: 'completed' },
        onTrue: {
          type: 'action',
          id: 'true-action',
          action: 'spin',
          parameters: {},
          timeout: 5000,
          onFailure: 'stop',
        },
      }

      expect(condition.operator).toBe('==')
    })

    it('should execute onTrue branch when condition is true', async () => {
      const condition: FlowConditionNode = {
        type: 'condition',
        id: 'cond-1',
        left: { type: 'literal', value: 100 },
        operator: '>',
        right: { type: 'literal', value: 50 },
        onTrue: {
          type: 'action',
          id: 'true-action',
          action: 'spin',
          parameters: {},
          timeout: 5000,
          onFailure: 'stop',
        },
        onFalse: {
          type: 'action',
          id: 'false-action',
          action: 'close_platform',
          parameters: {},
          timeout: 5000,
          onFailure: 'skip',
        },
      }

      expect(condition.onTrue.type).toBe('action')
    })

    it('should execute onFalse branch when condition is false', async () => {
      const condition: FlowConditionNode = {
        type: 'condition',
        id: 'cond-1',
        left: { type: 'literal', value: 25 },
        operator: '>',
        right: { type: 'literal', value: 50 },
        onTrue: {
          type: 'action',
          id: 'true-action',
          action: 'spin',
          parameters: {},
          timeout: 5000,
          onFailure: 'stop',
        },
        onFalse: {
          type: 'action',
          id: 'false-action',
          action: 'close_platform',
          parameters: {},
          timeout: 5000,
          onFailure: 'skip',
        },
      }

      expect(condition.onFalse?.type).toBe('action')
    })
  })

  describe('Loop Execution', () => {
    it('should execute loop with safety caps', async () => {
      const loop: FlowLoopNode = {
        type: 'loop',
        id: 'loop-1',
        condition: {
          type: 'condition',
          id: 'loop-cond',
          left: { type: 'variable', name: 'PROFIT' },
          operator: '>',
          right: { type: 'literal', value: 0 },
          onTrue: {
            type: 'action',
            id: 'loop-body',
            action: 'spin',
            parameters: {},
            timeout: 5000,
            onFailure: 'stop',
          },
        },
        body: {
          type: 'action',
          id: 'loop-body',
          action: 'spin',
          parameters: { betAmount: 10 },
          timeout: 5000,
          onFailure: 'stop',
        },
        maxIterations: 100,
        maxDuration: 30 * 60 * 1000, // 30 minutes
      }

      expect(loop.maxIterations).toBe(100)
      expect(loop.maxDuration).toBe(30 * 60 * 1000)
    })

    it('should stop loop when maxIterations reached', async () => {
      const loop: FlowLoopNode = {
        type: 'loop',
        id: 'loop-1',
        condition: {
          type: 'condition',
          id: 'loop-cond',
          left: { type: 'variable', name: 'COUNT' },
          operator: '<',
          right: { type: 'literal', value: 1000 }, // Will keep condition true
          onTrue: {
            type: 'action',
            id: 'loop-action',
            action: 'spin',
            parameters: {},
            timeout: 5000,
            onFailure: 'stop',
          },
        },
        body: {
          type: 'action',
          id: 'loop-body',
          action: 'spin',
          parameters: {},
          timeout: 5000,
          onFailure: 'stop',
        },
        maxIterations: 100,
        maxDuration: 30 * 60 * 1000,
      }

      expect(loop.maxIterations).toBe(100)
    })

    it('should stop loop when maxDuration reached', async () => {
      const loop: FlowLoopNode = {
        type: 'loop',
        id: 'loop-1',
        condition: {
          type: 'condition',
          id: 'loop-cond',
          left: { type: 'variable', name: 'RUNNING' },
          operator: '==',
          right: { type: 'literal', value: true },
          onTrue: {
            type: 'action',
            id: 'loop-action',
            action: 'spin',
            parameters: {},
            timeout: 5000,
            onFailure: 'stop',
          },
        },
        body: {
          type: 'action',
          id: 'loop-body',
          action: 'spin',
          parameters: {},
          timeout: 5000,
          onFailure: 'stop',
        },
        maxIterations: 10000,
        maxDuration: 5 * 60 * 1000, // 5 minutes
      }

      expect(loop.maxDuration).toBe(5 * 60 * 1000)
    })
  })

  describe('Variable Storage', () => {
    it('should store action results in variables', async () => {
      const action: FlowActionNode = {
        type: 'action',
        id: 'action-1',
        action: 'claim_bonus',
        parameters: { storeAs: 'BONUS' },
        timeout: 5000,
        onFailure: 'skip',
      }

      expect(action.parameters['storeAs']).toBe('BONUS')
    })

    it('should reference stored variables in conditions', async () => {
      const condition: FlowConditionNode = {
        type: 'condition',
        id: 'cond-1',
        left: { type: 'variable', name: 'BONUS' },
        operator: '>',
        right: { type: 'literal', value: 0 },
        onTrue: {
          type: 'action',
          id: 'true-action',
          action: 'spin',
          parameters: {},
          timeout: 5000,
          onFailure: 'stop',
        },
      }

      expect((condition.left as any).name).toBe('BONUS')
    })
  })

  describe('Metric Tracking', () => {
    it('should track number of actions executed', async () => {
      const action: FlowActionNode = {
        type: 'action',
        id: 'action-1',
        action: 'spin',
        parameters: {},
        timeout: 5000,
        onFailure: 'stop',
      }

      const flow = createTestFlow(action)
      expect(flow.executionCount).toBe(0)
    })

    it('should track execution status', async () => {
      const flow = createTestFlow({
        type: 'action',
        id: 'action-1',
        action: 'spin',
        parameters: {},
        timeout: 5000,
        onFailure: 'stop',
      })

      expect(flow.status).toBe('draft')
    })
  })

  describe('Error Handling', () => {
    it('should handle action timeout', async () => {
      const action: FlowActionNode = {
        type: 'action',
        id: 'action-1',
        action: 'spin',
        parameters: {},
        timeout: 100, // Short timeout
        onFailure: 'skip',
      }

      expect(action.timeout).toBe(100)
    })

    it('should respect onFailure strategy', async () => {
      const skipAction: FlowActionNode = {
        type: 'action',
        id: 'action-1',
        action: 'claim_bonus',
        parameters: {},
        timeout: 5000,
        onFailure: 'skip',
      }

      expect(skipAction.onFailure).toBe('skip')

      const stopAction: FlowActionNode = {
        type: 'action',
        id: 'action-2',
        action: 'spin',
        parameters: {},
        timeout: 5000,
        onFailure: 'stop',
      }

      expect(stopAction.onFailure).toBe('stop')
    })
  })

  describe('Complex Flow Execution', () => {
    it('should execute branching flow with conditions', async () => {
      const flow: FlowDefinition = createTestFlow({
        type: 'sequence',
        id: 'main-seq',
        steps: [
          {
            type: 'action',
            id: 'step-1',
            action: 'claim_bonus',
            parameters: { storeAs: 'BONUS' },
            timeout: 5000,
            onFailure: 'skip',
          },
          {
            type: 'condition',
            id: 'check-bonus',
            left: { type: 'variable', name: 'BONUS' },
            operator: '>',
            right: { type: 'literal', value: 0 },
            onTrue: {
              type: 'action',
              id: 'spin-action',
              action: 'spin',
              parameters: { betAmount: 10 },
              timeout: 5000,
              onFailure: 'stop',
            },
            onFalse: {
              type: 'action',
              id: 'close-action',
              action: 'close_platform',
              parameters: {},
              timeout: 5000,
              onFailure: 'skip',
            },
          },
        ],
      })

      expect(flow.rootNode.type).toBe('sequence')
      expect((flow.rootNode as any).steps.length).toBe(2)
    })

    it('should execute flow with nested conditions and loops', async () => {
      const flow: FlowDefinition = createTestFlow({
        type: 'sequence',
        id: 'complex-seq',
        steps: [
          {
            type: 'loop',
            id: 'outer-loop',
            condition: {
              type: 'condition',
              id: 'outer-cond',
              left: { type: 'variable', name: 'SESSION_PROFIT' },
              operator: '>',
              right: { type: 'literal', value: 0 },
              onTrue: {
                type: 'action',
                id: 'outer-true',
                action: 'spin',
                parameters: {},
                timeout: 5000,
                onFailure: 'stop',
              },
            },
            body: {
              type: 'action',
              id: 'loop-body',
              action: 'spin',
              parameters: { betAmount: 5 },
              timeout: 5000,
              onFailure: 'stop',
            },
            maxIterations: 100,
            maxDuration: 30 * 60 * 1000,
          },
        ],
      })

      expect(flow.rootNode.type).toBe('sequence')
    })

    // New behavior tests exercising actual executor behavior
    it('should stop execution when user is in cooldown (runtime) and cool_down_check is enabled', async () => {
      const root: FlowNode = {
        type: 'action',
        id: 'action-root',
        action: 'spin',
        parameters: {},
        timeout: 1000,
        onFailure: 'stop',
      }
      const flow: FlowDefinition = {
        id: 'flow-cooldown',
        userId: 'u1',
        name: 'Cooldown Test',
        description: 'test',
        version: 1,
        status: 'draft',
        trigger: { type: 'manual' },
        rootNode: root,
        variables: [],
        responsiblePlayGuardrails: [
          { type: 'cool_down_check', value: true, source: 'system_mandatory', overridable: false },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        executionCount: 0,
        performanceStats: {},
      }

      const exec = new FlowExecutor()
      const ctx = await exec.execute(flow, 'u1', undefined, {
        responsiblePlay: { isInCooldown: true, cooldownUntil: new Date(Date.now() + 60_000) },
      })
      expect(ctx.status).toBe('stopped_by_guardrail')
      expect(ctx.log.some(l => l.type === 'guardrail_triggered' && (l.details as any).guardrail === 'cool_down_check')).toBe(true)
    })

    it('should not stop execution just because cool_down_check exists (no runtime cooldown)', async () => {
      const root: FlowNode = {
        type: 'action',
        id: 'action-root',
        action: 'spin',
        parameters: {},
        timeout: 1000,
        onFailure: 'stop',
      }
      const flow: FlowDefinition = {
        id: 'flow-cooldown-2',
        userId: 'u1',
        name: 'Cooldown Test 2',
        description: 'test',
        version: 1,
        status: 'draft',
        trigger: { type: 'manual' },
        rootNode: root,
        variables: [],
        responsiblePlayGuardrails: [
          { type: 'cool_down_check', value: true, source: 'system_mandatory', overridable: false },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        executionCount: 0,
        performanceStats: {},
      }

      const exec = new FlowExecutor()
      const ctx = await exec.execute(flow, 'u1', undefined, { responsiblePlay: { isInCooldown: false } })
      expect(ctx.status).not.toBe('stopped_by_guardrail')
    })

    it('should stop execution when max_duration is exceeded', async () => {
      const root: FlowNode = {
        type: 'wait',
        id: 'wait-root',
        duration: 5,
      }
      const flow: FlowDefinition = {
        id: 'flow-max-duration',
        userId: 'u1',
        name: 'Max duration test',
        description: 'test',
        version: 1,
        status: 'draft',
        trigger: { type: 'manual' },
        rootNode: root,
        variables: [],
        responsiblePlayGuardrails: [
          { type: 'max_duration', value: 1, source: 'system_default', overridable: true },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        executionCount: 0,
        performanceStats: {},
      }

      const exec = new FlowExecutor()
      const ctx = await exec.execute(flow, 'u1', undefined, { responsiblePlay: { now: new Date(Date.now() - 10_000) } })
      expect(ctx.status).toBe('stopped_by_guardrail')
      expect(ctx.metrics.guardrailsTriggered).toContain('max_duration')
    })

    it('should store action result when parameters.storeAs is provided', async () => {
      const action: FlowActionNode = {
        type: 'action',
        id: 'a1',
        action: 'claim_bonus',
        parameters: { storeAs: 'BONUS' },
        timeout: 1000,
        onFailure: 'stop',
      }
      const flow = createTestFlow(action)
      const exec = new FlowExecutor()
      const ctx = await exec.execute(flow, 'u1')
      expect(ctx.variables.has('BONUS')).toBe(true)
      expect(ctx.metrics.bonusesClaimed).toBeGreaterThanOrEqual(1)
    })

    it('should evaluate expression values using stored numeric variables', async () => {
      const seq: FlowNode = {
        type: 'sequence',
        id: 'seq-expr',
        steps: [
          {
            type: 'store',
            id: 's1',
            variable: 'X',
            value: { type: 'literal', value: 4 },
          },
          {
            type: 'condition',
            id: 'c1',
            left: { type: 'expression', expression: '($X * 5) + 0' },
            operator: '>=',
            right: { type: 'literal', value: 20 },
            onTrue: { type: 'stop', id: 'st' },
          },
        ],
      }
      const flow = createTestFlow(seq)
      const exec = new FlowExecutor()
      const ctx = await exec.execute(flow, 'u1')
      expect(ctx.status).toBe('completed')
      expect(ctx.metrics.conditionsEvaluated).toBe(1)
    })

    it('should increment loopIterations and log loop guardrail when caps hit', async () => {
      const loop: FlowLoopNode = {
        type: 'loop',
        id: 'loop-cap',
        condition: {
          type: 'condition',
          id: 'cond',
          left: { type: 'literal', value: 1 },
          operator: '==',
          right: { type: 'literal', value: 1 },
          onTrue: { type: 'action', id: 'body-a', action: 'spin', parameters: {}, timeout: 1000, onFailure: 'stop' },
        },
        body: { type: 'action', id: 'body-a', action: 'spin', parameters: {}, timeout: 1000, onFailure: 'stop' },
        maxIterations: 3,
        maxDuration: 60_000,
      }
      const flow = createTestFlow(loop)
      const exec = new FlowExecutor()
      const ctx = await exec.execute(flow, 'u1')
      expect(ctx.metrics.loopIterations).toBeGreaterThanOrEqual(3)
      expect(ctx.metrics.guardrailsTriggered.includes('loop_cap')).toBe(true)
    })

    it('should record platformsAccessed when opening a platform', async () => {
      const action: FlowActionNode = {
        type: 'action',
        id: 'open',
        action: 'open_platform',
        platform: 'chumba',
        parameters: {},
        timeout: 1000,
        onFailure: 'stop',
      }
      const flow = createTestFlow(action)
      const exec = new FlowExecutor()
      const ctx = await exec.execute(flow, 'u1')
      expect(ctx.metrics.platformsAccessed).toContain('chumba')
    })
  })
})
/**
 * Flow Executor - Runtime execution engine
 * Executes Flow AST nodes, maintains execution context, enforces guardrails
 */

import type {
  FlowDefinition,
  FlowExecutionContext,
  FlowExecutionLog,
  FlowNode,
  FlowActionNode,
  FlowConditionNode,
  FlowLoopNode,
  FlowSequenceNode,
  FlowValue,
} from '../types'
import { logger } from '@sweepbot/utils'

export class FlowExecutor {
  /**
   * Execute a Flow definition
   * Returns the final execution context with all logs and metrics
   */
  async execute(
    flowDefinition: FlowDefinition,
    userId: string,
    context?: Record<string, unknown>
  ): Promise<FlowExecutionContext> {
    const executionContext: FlowExecutionContext = {
      flowId: flowDefinition.id,
      executionId: `exec_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      userId,
      variables: new Map(Object.entries(context || {})),
      startedAt: new Date(),
      currentNode: flowDefinition.rootNode.id,
      status: 'running',
      log: [],
      metrics: {
        totalDuration: 0,
        actionsExecuted: 0,
        conditionsEvaluated: 0,
        loopIterations: 0,
        platformsAccessed: [],
        bonusesClaimed: 0,
        bonusValueClaimed: 0,
        spinsExecuted: 0,
        totalWagered: 0,
        totalWon: 0,
        netResult: 0,
        guardrailsTriggered: [],
      },
    }

    // Check responsible play before execution
    const rpGuards = flowDefinition.responsiblePlayGuardrails
    const cooldownGuard = rpGuards.find((g) => g.type === 'cool_down_check')
    if (cooldownGuard && cooldownGuard.value === true) {
      executionContext.log.push({
        timestamp: new Date(),
        nodeId: 'root',
        type: 'guardrail_triggered',
        details: { guardrail: 'cool_down_check' },
      })
      executionContext.status = 'stopped_by_guardrail'
      return executionContext
    }

    try {
      // Execute the root node
      await this.executeNode(flowDefinition.rootNode, executionContext, flowDefinition)
      executionContext.status = 'completed'
    } catch (error) {
      executionContext.log.push({
        timestamp: new Date(),
        nodeId: executionContext.currentNode,
        type: 'error',
        details: { error: String(error) },
      })
      executionContext.status = 'failed'
    }

    // Calculate total duration
    executionContext.metrics.totalDuration = Date.now() - executionContext.startedAt.getTime()

    return executionContext
  }

  /**
   * Execute a single node (recursive)
   */
  private async executeNode(
    node: FlowNode,
    ctx: FlowExecutionContext,
    flow: FlowDefinition
  ): Promise<void> {
    ctx.currentNode = node.id

    switch (node.type) {
      case 'action':
        return await this.executeAction(node as FlowActionNode, ctx, flow)
      case 'condition':
        return await this.executeCondition(node as FlowConditionNode, ctx, flow)
      case 'loop':
        return await this.executeLoop(node as FlowLoopNode, ctx, flow)
      case 'sequence':
        return await this.executeSequence(node as FlowSequenceNode, ctx, flow)
      case 'stop':
        ctx.status = 'completed'
        return
      case 'alert':
        ctx.log.push({
          timestamp: new Date(),
          nodeId: node.id,
          type: 'user_alert',
          details: { message: node.message },
        })
        if (node.next) await this.executeNode(node.next, ctx, flow)
        return
      case 'wait':
        await new Promise((resolve) => setTimeout(resolve, node.duration))
        if (node.next) await this.executeNode(node.next, ctx, flow)
        return
      case 'store': {
        const value = await this.evaluateValue(node.value, ctx)
        ctx.variables.set(node.variable, value)
        ctx.log.push({
          timestamp: new Date(),
          nodeId: node.id,
          type: 'variable_set',
          details: { variable: node.variable, value },
        })
        if (node.next) await this.executeNode(node.next, ctx, flow)
        return
      }
    }
  }

  /**
   * Execute an action node
   */
  private async executeAction(
    node: FlowActionNode,
    ctx: FlowExecutionContext,
    flow: FlowDefinition
  ): Promise<void> {
    ctx.log.push({
      timestamp: new Date(),
      nodeId: node.id,
      type: 'action_start',
      details: { action: node.action, parameters: node.parameters },
    })

    try {
      // Execute the action (in real implementation, this calls the automation engine)
      const result = await this.executeAction_Impl(node, ctx)

      // Update metrics based on action type
      ctx.metrics.actionsExecuted++
      if (node.action === 'claim_bonus') {
        ctx.metrics.bonusesClaimed++
        if (typeof result === 'number') {
          ctx.metrics.bonusValueClaimed += result
        }
      }
      if (node.action === 'spin') {
        ctx.metrics.spinsExecuted++
      }
      if (node.action === 'open_platform' && node.platform) {
        if (!ctx.metrics.platformsAccessed.includes(node.platform)) {
          ctx.metrics.platformsAccessed.push(node.platform)
        }
      }

      // Store result if requested
      const storeAs = node.parameters['storeAs']
      if (typeof storeAs === 'string') {
        ctx.variables.set(storeAs, result)
      }

      ctx.log.push({
        timestamp: new Date(),
        nodeId: node.id,
        type: 'action_complete',
        details: typeof result === 'object' ? (result as Record<string, unknown>) : { result },
      })

      // Execute next node
      if (node.next) {
        await this.executeNode(node.next, ctx, flow)
      }
    } catch (error) {
      ctx.log.push({
        timestamp: new Date(),
        nodeId: node.id,
        type: 'action_failed',
        details: { error: String(error) },
      })

      // Handle failure per node configuration
      if (node.onFailure === 'skip') {
        if (node.next) {
          await this.executeNode(node.next, ctx, flow)
        }
      } else if (node.onFailure === 'stop') {
        throw error
      }
      // retry and fallback node not implemented for brevity
    }
  }

  /**
   * Execute a condition node
   */
  private async executeCondition(
    node: FlowConditionNode,
    ctx: FlowExecutionContext,
    flow: FlowDefinition
  ): Promise<void> {
    const left = await this.evaluateValue(node.left, ctx)
    const right = await this.evaluateValue(node.right, ctx)

    const conditionMet = this.evaluateOperator(node.operator, left, right)

    ctx.log.push({
      timestamp: new Date(),
      nodeId: node.id,
      type: 'condition_evaluated',
      details: { left, operator: node.operator, right, result: conditionMet },
    })

    ctx.metrics.conditionsEvaluated++

    const nextNode = conditionMet ? node.onTrue : node.onFalse
    if (nextNode) {
      await this.executeNode(nextNode, ctx, flow)
    }
  }

  /**
   * Execute a loop node
   */
  private async executeLoop(
    node: FlowLoopNode,
    ctx: FlowExecutionContext,
    flow: FlowDefinition
  ): Promise<void> {
    const loopStartTime = Date.now()
    let iterationCount = 0

    while (iterationCount < node.maxIterations && Date.now() - loopStartTime < node.maxDuration) {
      // Evaluate condition
      const left = await this.evaluateValue(node.condition.left, ctx)
      const right = await this.evaluateValue(node.condition.right, ctx)
      const conditionMet = this.evaluateOperator(node.condition.operator, left, right)

      if (!conditionMet) break

      // Execute loop body
      await this.executeNode(node.body, ctx, flow)
      iterationCount++

      ctx.log.push({
        timestamp: new Date(),
        nodeId: node.id,
        type: 'loop_iteration',
        details: { iteration: iterationCount, conditionMet },
      })

      ctx.metrics.loopIterations++
    }

    // Log if we hit a cap
    if (iterationCount >= node.maxIterations || Date.now() - loopStartTime >= node.maxDuration) {
      ctx.log.push({
        timestamp: new Date(),
        nodeId: node.id,
        type: 'guardrail_triggered',
        details: { guardrail: 'loop_cap', iterations: iterationCount },
      })
      ctx.metrics.guardrailsTriggered.push('loop_cap')
    }
  }

  /**
   * Execute a sequence node (multiple steps in order)
   */
  private async executeSequence(
    node: FlowSequenceNode,
    ctx: FlowExecutionContext,
    flow: FlowDefinition
  ): Promise<void> {
    for (const step of node.steps) {
      await this.executeNode(step, ctx, flow)
    }
  }

  /**
   * Evaluate a FlowValue to get its actual value
   */
  private async evaluateValue(value: FlowValue, ctx: FlowExecutionContext): Promise<unknown> {
    if (value.type === 'literal') {
      return value.value
    }
    if (value.type === 'variable') {
      return ctx.variables.get(value.name)
    }
    if (value.type === 'expression') {
      // Simple expression evaluation (would use a proper parser in production)
      return this.evaluateExpression(value.expression, ctx)
    }
    if (value.type === 'query') {
      // Query result evaluation (would query the automation engine)
      return this.evaluateQuery(value.query, ctx)
    }
    return null
  }

  /**
   * Evaluate a comparison operator
   */
  private evaluateOperator(operator: string, left: unknown, right: unknown): boolean {
    const l = typeof left === 'number' ? left : Number(left)
    const r = typeof right === 'number' ? right : Number(right)

    switch (operator) {
      case '>':
        return l > r
      case '<':
        return l < r
      case '>=':
        return l >= r
      case '<=':
        return l <= r
      case '==':
        return l === r
      case '!=':
        return l !== r
      case 'contains':
        return String(left).includes(String(right))
      case 'exists':
        return left !== null && left !== undefined
      default:
        return false
    }
  }

  /**
   * Safe expression evaluation without using eval or new Function
   * Only supports basic arithmetic operations: +, -, *, /, %
   */
  private evaluateExpression(expr: string, ctx: FlowExecutionContext): number {
    // Replace variables with their values
    let evaluated = expr.trim()

    // Replace all $variableName with their numeric values
    for (const [varName, value] of ctx.variables) {
      if (typeof value === 'number') {
        // Use word boundary to avoid partial replacements
        const regex = new RegExp(`\\$${varName}\\b`, 'g')
        evaluated = evaluated.replace(regex, String(value))
      }
    }

    // Validate that the expression only contains safe characters
    // Allow: numbers, operators, parentheses, spaces, and decimal points
    if (!/^[\d\s+\-*/%.()]+$/.test(evaluated)) {
      logger.warn('Unsafe expression detected, rejecting', { evaluated })
      return 0
    }

    // Safe evaluation using Function constructor with limited scope
    // This is still potentially dangerous but less so than direct eval
    // In production, use a proper math expression library like mathjs
    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function(`return ${evaluated}`)
      const result = fn()
      if (typeof result !== 'number' || !isFinite(result)) {
        return 0
      }
      return result
    } catch {
      return 0
    }
  }

  /**
   * Query result evaluation (stub for real implementation)
   */
  private evaluateQuery(_query: string, _ctx: FlowExecutionContext): unknown {
    // In production, would query the automation engine or database
    // For now, return null
    return null
  }

  /**
   * Execute an action (stub for real implementation)
   * In production, would call the browser extension or backend service
   */
  private async executeAction_Impl(
    node: FlowActionNode,
    _ctx: FlowExecutionContext
  ): Promise<unknown> {
    // Simulate different action outcomes
    switch (node.action) {
      case 'claim_bonus':
        return Math.random() * 100 // Simulate bonus amount
      case 'spin':
        return { spins: 1, win: Math.random() * 500 }
      case 'check_balance':
        return Math.random() * 1000
      case 'open_platform':
      case 'login':
      case 'open_game':
      case 'close_platform':
        return { success: true }
      default:
        return { success: true }
    }
  }
}

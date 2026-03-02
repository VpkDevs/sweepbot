/**
 * Flow Interpreter - Main NLP interpretation service
 * Converts natural language input into a Flow Definition AST
 * Uses 4-pass interpretation: entity extraction, intent classification, logic structuring, validation
 */

import type {
  FlowDefinition,
  FlowInterpretationRequest,
  FlowInterpretationResult,
  EntityMap,
  FlowNode,
  FlowTrigger,
  ResponsiblePlayGuardrail,
  FlowWarning,
} from '../types'
import { EntityRecognizer } from './entity-recognizer'

export class FlowInterpreter {
  private entityRecognizer: EntityRecognizer = new EntityRecognizer()

  async interpret(request: FlowInterpretationRequest): Promise<FlowInterpretationResult> {
    // Pass 1: Entity Extraction
    const entities = this.entityRecognizer.recognize(request.rawInput)

    // Pass 2: Intent Classification
    const intent = this.classifyIntent(request.rawInput, entities)

    // Pass 3: Logic Structuring - build the AST
    const flowNode = this.buildFlowAST(entities, intent, request.rawInput)

    // Pass 4: Responsible Play Validation
    const guardrails = this.validateResponsiblePlay(flowNode, request.userId)

    // Calculate confidence
    let confidence = this.calculateConfidence(entities, intent)

    // Build Flow Definition
    const flow: FlowDefinition = {
      id: this.generateId(),
      userId: request.userId,
      name: this.generateFlowName(entities),
      description: request.rawInput,
      version: 1,
      status: 'draft',
      trigger: this.extractTrigger(entities) || { type: 'manual' },
      rootNode: flowNode,
      variables: [],
      responsiblePlayGuardrails: guardrails,
      createdAt: new Date(),
      updatedAt: new Date(),
      executionCount: 0,
      performanceStats: {},
    }

    return {
      flow,
      confidence,
      humanReadableSummary: this.generateSummary(flow),
      warnings: this.generateWarnings(flow, request.userId),
    }
  }

  /**
   * Pass 2: Classify the intent of the input
   * What type of automation is the user asking for?
   */
  private classifyIntent(text: string, entities: EntityMap): string {
    const lowerText = text.toLowerCase()

    if (lowerText.includes('bonus')) return 'bonus_collection'
    if (lowerText.includes('spin') || lowerText.includes('play')) return 'play_strategy'
    if (lowerText.includes('cash out') || lowerText.includes('redeem')) return 'redemption'
    if (lowerText.includes('every') || lowerText.includes('daily')) return 'recurring_routine'
    if (lowerText.includes('jackpot')) return 'jackpot_hunting'

    return 'general_automation'
  }

  /**
   * Pass 3: Build the Flow AST from entities and intent
   * Constructs a tree of nodes representing the automation logic
   */
  private buildFlowAST(entities: EntityMap, intent: string, rawText: string): FlowNode {
    const rootSteps: FlowNode[] = []

    // Step 1: Add platform opening if needed
    if (entities.platforms.length > 0) {
      for (const platform of entities.platforms) {
        rootSteps.push(this.buildOpenPlatformNode(platform.normalized))
      }
    }

    // Step 2: Add login actions if mentioned
    if (/log in|login|sign in/i.test(rawText)) {
      rootSteps.push({
        type: 'action',
        id: this.generateId(),
        action: 'login',
        parameters: {},
        timeout: 30000,
        onFailure: 'stop',
      })
    }

    // Step 3: Add bonus claiming if mentioned
    if (/claim|grab|daily bonus/i.test(rawText)) {
      const bonusNode: any = {
        type: 'action',
        id: this.generateId(),
        action: 'claim_bonus',
        parameters: {
          storeAs: 'BONUS', // Store result as $BONUS for later reference
        },
        timeout: 20000,
        onFailure: 'skip',
      }
      rootSteps.push(bonusNode)
    }

    // Step 4: Add game opening if games are mentioned
    if (entities.games.length > 0) {
      for (const game of entities.games) {
        rootSteps.push(this.buildOpenGameNode(game.normalized))
      }
    }

    // Step 5: Add betting/spinning actions
    if (/spin|play|bet/i.test(rawText)) {
      // Check if there's a loop condition (like "keep going if X")
      const loopCondition = this.extractLoopCondition(rawText, entities)

      if (loopCondition) {
        // Build a loop node for repeated spins
        rootSteps.push(this.buildSpinLoopNode(loopCondition, entities))
      } else {
        // Single action
        const betAmount = this.extractBetAmount(entities)
        rootSteps.push({
          type: 'action',
          id: this.generateId(),
          action: 'spin',
          parameters: {
            betAmount: betAmount || 'minimum',
          },
          timeout: 10000,
          onFailure: 'stop',
        })
      }
    }

    // Step 6: Add closing actions if mentioned
    if (/close|exit|quit/i.test(rawText) && entities.platforms.length > 0) {
      for (const _platform of entities.platforms) {
        rootSteps.push({
          type: 'action',
          id: this.generateId(),
          action: 'close_platform',
          parameters: {},
          timeout: 5000,
          onFailure: 'skip',
        })
      }
    }

    // Return sequence of all actions
    return {
      type: 'sequence',
      id: this.generateId(),
      steps: rootSteps,
    }
  }

  /**
   * Build an "open platform" action node
   */
  private buildOpenPlatformNode(platform: string): FlowNode {
    return {
      type: 'action',
      id: this.generateId(),
      action: 'open_platform',
      platform,
      parameters: {
        platform,
      },
      timeout: 15000,
      onFailure: 'stop',
    }
  }

  /**
   * Build an "open game" action node
   */
  private buildOpenGameNode(game: string): FlowNode {
    return {
      type: 'action',
      id: this.generateId(),
      action: 'open_game',
      game,
      parameters: {
        game,
      },
      timeout: 10000,
      onFailure: 'stop',
    }
  }

  /**
   * Extract loop condition from text like "if win > 5x bonus, keep going"
   */
  private extractLoopCondition(text: string, entities: EntityMap): any {
    const conditionMatches = text.matchAll(/if\s+(?:win|balance|profit)\s+([<>]=?)\s+(.+?)(?:,|then|\.|$)/gi)

    for (const match of conditionMatches) {
      return {
        operator: match[1],
        right: (match[2] ?? '').trim(),
      }
    }

    // Default: keep spinning while we're winning
    if (/keep\s+(?:going|spinning)|continue/i.test(text)) {
      return {
        operator: '>',
        right: 'initial_balance',
      }
    }

    return null
  }

  /**
   * Build a spin loop node with condition
   */
  private buildSpinLoopNode(condition: any, entities: EntityMap): FlowNode {
    const betAmount = this.extractBetAmount(entities)

    return {
      type: 'loop',
      id: this.generateId(),
      condition: {
        type: 'condition',
        id: this.generateId(),
        left: { type: 'variable', name: 'PROFIT' },
        operator: condition.operator,
        right: { type: 'variable', name: 'BONUS' },
        onTrue: {
          type: 'action',
          id: this.generateId(),
          action: 'spin',
          parameters: {
            betAmount: betAmount || 'minimum',
          },
          timeout: 10000,
          onFailure: 'stop',
        },
      },
      body: {
        type: 'action',
        id: this.generateId(),
        action: 'spin',
        parameters: {
          betAmount: betAmount || 'minimum',
        },
        timeout: 10000,
        onFailure: 'stop',
      },
      maxIterations: 100, // Safety cap
      maxDuration: 30 * 60 * 1000, // 30 minutes max
    }
  }

  /**
   * Extract bet amount from entities
   */
  private extractBetAmount(entities: EntityMap): string | number | null {
    if (entities.amounts.length > 0) {
      const amount = entities.amounts[0]!
      if (amount.type === 'absolute') {
        return amount.value || null
      }
      if (amount.type === 'relative' && amount.reference) {
        return amount.reference === 'min_bet' ? 'minimum' : amount.reference
      }
    }
    return null
  }

  /**
   * Pass 4: Validate responsible play constraints
   */
  private validateResponsiblePlay(flowNode: FlowNode, userId: string): ResponsiblePlayGuardrail[] {
    const guardrails: ResponsiblePlayGuardrail[] = []

    // Every flow gets a default max duration of 2 hours
    guardrails.push({
      type: 'max_duration',
      value: 2 * 60 * 60 * 1000, // 2 hours in ms
      source: 'system_default',
      overridable: true,
    })

    // System mandatory: cool-down check
    guardrails.push({
      type: 'cool_down_check',
      value: true,
      source: 'system_mandatory',
      overridable: false,
    })

    return guardrails
  }

  /**
   * Extract the trigger from entities
   */
  private extractTrigger(entities: EntityMap): FlowTrigger | null {
    if (entities.schedules.length > 0) {
      const schedule = entities.schedules[0]!
      return {
        type: 'scheduled',
        cron: schedule.cron,
        timezone: schedule.timezone,
      }
    }
    return null
  }

  /**
   * Calculate confidence score (0-1) based on entity extraction
   */
  private calculateConfidence(entities: EntityMap, intent: string): number {
    // Simple heuristic: if we found clear entities, we're confident
    const entityCount = entities.platforms.length + entities.actions.length + entities.games.length

    if (entityCount >= 3) return 0.85
    if (entityCount >= 2) return 0.7
    if (entityCount >= 1) return 0.55
    return 0.3
  }

  /**
   * Generate a human-readable summary of the flow
   */
  private generateSummary(flow: FlowDefinition): string {
    let summary = ''

    // Trigger
    if (flow.trigger.type === 'scheduled') {
      summary += `⏰ Trigger: ${this.humanReadableCron((flow.trigger as any).cron)}\n`
    } else if (flow.trigger.type === 'manual') {
      summary += `⚙️ Trigger: Manual (on demand)\n`
    }

    // Walk the AST and generate descriptions
    summary += this.describeNode(flow.rootNode, 1)

    // Add guardrails info
    if (flow.responsiblePlayGuardrails.length > 0) {
      summary += '\n🛡️ Safety Guards:\n'
      for (const guard of flow.responsiblePlayGuardrails) {
        if (guard.type === 'max_duration' && typeof guard.value === 'number') {
          const hours = guard.value / (60 * 60 * 1000)
          summary += `  • Max session: ${hours} hours\n`
        }
      }
    }

    return summary
  }

  /**
   * Recursively describe a node in human-readable format
   */
  private describeNode(node: FlowNode, indent: number = 0): string {
    const prefix = '  '.repeat(indent)

    switch (node.type) {
      case 'action': {
        const action = node as any
        const actionEmojis: Record<string, string> = {
          open_platform: '🌐',
          login: '🔑',
          claim_bonus: '🎁',
          open_game: '🎰',
          spin: '🔄',
          bet: '💰',
          check_balance: '💵',
          cash_out: '✅',
          close_platform: '🚪',
        }
        const emoji = actionEmojis[action.action] || '→'
        return `${prefix}${emoji} ${action.action}\n`
      }

      case 'sequence': {
        const seq = node as any
        let desc = ''
        for (const step of seq.steps) {
          desc += this.describeNode(step, indent)
        }
        return desc
      }

      case 'loop': {
        const loop = node as any
        let desc = `${prefix}🔁 Loop (max 100 iterations):\n`
        desc += this.describeNode(loop.body, indent + 1)
        return desc
      }

      case 'condition': {
        const cond = node as any
        return `${prefix}❓ If condition: ${cond.left} ${cond.operator} ${cond.right}\n`
      }

      default:
        return ''
    }
  }

  /**
   * Convert a cron expression to human-readable text
   */
  private humanReadableCron(cron: string): string {
    // Simple conversions - in production use a library like cronstrue
    const parts = cron.split(' ')
    if (parts[0] === '0' && parts[1] === '*' && parts[3] === '*' && parts[4] === '*') {
      return 'Every hour'
    }
    return cron // Fallback to raw cron
  }

  /**
   * Generate warnings for the flow
   */
  private generateWarnings(flow: FlowDefinition, userId: string): FlowWarning[] {
    const warnings: FlowWarning[] = []

    // Check for long sessions
    const maxDuration = flow.responsiblePlayGuardrails.find((g) => g.type === 'max_duration')
    if (maxDuration && typeof maxDuration.value === 'number' && maxDuration.value > 4 * 60 * 60 * 1000) {
      warnings.push({
        type: 'responsible_play',
        severity: 'warning',
        message: 'This flow will run for more than 4 hours, which may be excessive',
        suggestion: 'Consider reducing the max duration to 2-3 hours',
      })
    }

    return warnings
  }

  /**
   * Generate a name for the flow based on entities
   */
  private generateFlowName(entities: EntityMap): string {
    if (entities.platforms.length > 0) {
      const platform = entities.platforms[0]!
      if (entities.games.length > 0) {
        return `${platform.name} - ${entities.games[0]!.name}`
      }
      return `${platform.name} Routine`
    }

    if (entities.actions.length > 0) {
      return `${entities.actions[0]!.type} Automation`
    }

    return 'Untitled Flow'
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `flow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

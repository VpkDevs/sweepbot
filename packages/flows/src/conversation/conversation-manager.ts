/**
 * Conversation Manager - Multi-turn Flow building
 * Handles back-and-forth refinement of Flows through natural conversation
 * Manages conversation state, interprets user refinements, and guides users toward complete flows
 */

import type { ConversationState, ConversationTurn, FlowDefinition, EntityMap, FlowWarning } from '../types'

export interface ConversationManagerOptions {
  onStateSave?: (state: ConversationState) => Promise<void>
  onStateLoad?: (conversationId: string) => Promise<ConversationState | null>
  flowInterpreter?: any // FlowInterpreter instance
  logger?: { info: (msg: string) => void; error: (msg: string, err: any) => void }
}

export class ConversationManager {
  private options: ConversationManagerOptions
  private logger: { info: (msg: string) => void; error: (msg: string, err: any) => void }
  // simple in-memory backup store used when no external persistence provided
  private memory: Map<string, ConversationState> = new Map()

  constructor(options: ConversationManagerOptions = {}) {
    this.options = options
    this.logger = options.logger || {
      info: (msg) => console.log(`[ConversationManager] ${msg}`),
      error: (msg, err) => console.error(`[ConversationManager] ${msg}`, err),
    }
  }

  /**
   * Start a new conversation for Flow building
   */
  async startConversation(
    userId: string,
    sessionId: string,
    initialFlowDescription: string
  ): Promise<ConversationState> {
    const state: ConversationState = {
      userId,
      sessionId,
      currentFlow: {},
      turns: [
        {
          role: 'user',
          content: initialFlowDescription,
          timestamp: new Date(),
        },
      ],
      pendingQuestions: [],
      status: 'building',
    }

    if (this.options.onStateSave) {
      await this.options.onStateSave(state)
    }

    this.logger.info(`Started conversation ${sessionId} for user ${userId}`)
    return state
  }

  /**
   * Continue an existing conversation
   * Process the user's new message and update the flow accordingly
   */
  async continue(conversationId: string, userMessage: string): Promise<ConversationState> {
    // Load conversation state
    let state: ConversationState | null = null
    if (this.options.onStateLoad) {
      state = await this.options.onStateLoad(conversationId)
    } else {
      state = this.memory.get(conversationId) ?? null
    }

    if (!state) {
      throw new Error(`Conversation ${conversationId} not found`)
    }

    // Add user message to turn history
    state.turns.push({
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    })

    try {
      // Interpret what the user is asking for
      const updateIntent = this.detectUpdateIntent(userMessage)

      // Apply the update to the current flow
      if (updateIntent.type === 'confirm') {
        // User said "yes", "looks good", "activate", etc.
        state.status = 'confirming'
      } else if (updateIntent.type === 'refine') {
        // User is adding/changing something
        await this.applyFlowRefinement(state, userMessage, updateIntent.keywords)
        state.status = 'building'
      } else if (updateIntent.type === 'question') {
        // User is asking for clarification
        const answer = this.answerFlowQuestion(userMessage, state.currentFlow)
        state.turns.push({
          role: 'assistant',
          content: answer,
          timestamp: new Date(),
        })
        state.status = 'building'
      }

      // Save updated state back if we're using in-memory store
      if (!this.options.onStateSave) {
        this.memory.set(conversationId, state)
      }
      // Check if we have enough info to confirm
      if (state.status === 'confirming') {
        if (this.isFlowComplete(state.currentFlow)) {
          const summary = this.generateConfirmationCard(state.currentFlow)
          state.turns.push({
            role: 'assistant',
            content: `Perfect! Here's your Flow:\n\n${summary}\n\nLooks good? Say "activate" to get started!`,
            timestamp: new Date(),
          })
        } else {
          state.status = 'building'
          const missing = this.getMissingFields(state.currentFlow)
          state.turns.push({
            role: 'assistant',
            content: `I need a few more details before we can activate:\n\n${missing.map((f) => `• ${f}`).join('\n')}`,
            timestamp: new Date(),
          })
        }
      } else if (state.status === 'building') {
        // Generate follow-up question if needed
        state.pendingQuestions = this.generateFollowUpQuestions(state.currentFlow)
        if (state.pendingQuestions.length > 0) {
          state.turns.push({
            role: 'assistant',
            content: state.pendingQuestions[0]!,
            timestamp: new Date(),
          })
        }
      }

      // Save updated state
      if (this.options.onStateSave) {
        await this.options.onStateSave(state)
      }

      this.logger.info(`Continued conversation ${conversationId}, status: ${state.status}`)
      return state
    } catch (error) {
      this.logger.error(`Error continuing conversation ${conversationId}`, error)
      throw error
    }
  }

  /**
   * Confirm and save a completed Flow
   */
  async confirm(conversationId: string): Promise<FlowDefinition> {
    let state: ConversationState | null = null
    if (this.options.onStateLoad) {
      state = await this.options.onStateLoad(conversationId)
    }

    if (!state) {
      throw new Error(`Conversation ${conversationId} not found`)
    }

    const flow = state.currentFlow as FlowDefinition

    if (!this.isFlowComplete(flow)) {
      throw new Error('Flow is not complete, cannot confirm')
    }

    // Mark conversation as complete
    state.status = 'complete'
    if (this.options.onStateSave) {
      await this.options.onStateSave(state)
    }

    this.logger.info(`Confirmed conversation ${conversationId}, created flow ${flow.id}`)
    return flow
  }

  /**
   * Detect what the user is trying to do with their message
   */
  private detectUpdateIntent(
    userMessage: string
  ): { type: 'confirm' | 'refine' | 'question'; keywords: string[] } {
    const lowerMessage = userMessage.toLowerCase()

    // Confirmation keywords
    if (/yes|yeah|looks good|perfect|activate|go ahead|start it|create|save/i.test(lowerMessage)) {
      return { type: 'confirm', keywords: ['confirm'] }
    }

    // Question keywords
    if (/what|why|how|can|should|when/i.test(lowerMessage) && /\?$/.test(userMessage)) {
      return { type: 'question', keywords: ['question'] }
    }

    // Refinement keywords (adding/changing something)
    // "Also open...", "Change the...", "Set the...", "Add...", "And then...", "But also..."
    const refinementPatterns = [
      /also\s+/i,
      /change\s+(?:the\s+)?/i,
      /set\s+(?:the\s+)?/i,
      /add\s+/i,
      /and\s+then\s+/i,
      /but\s+also\s+/i,
      /instead\s+(?:of\s+)?/i,
      /wait\s+,\s+/i,
      /one\s+more\s+thing/i,
      /don't\s+forget\s+/i,
    ]

    const hasRefinement = refinementPatterns.some((pattern) => pattern.test(lowerMessage))
    return { type: 'refine', keywords: ['refine'] }
  }

  /**
   * Apply a user's refinement to the flow
   */
  private async applyFlowRefinement(
    state: ConversationState,
    userMessage: string,
    _keywords: string[]
  ): Promise<void> {
    // This is a simplified version. In production, you'd run this through the interpreter
    // to extract entities and merge them with the existing flow definition.

    // For now, we just log that we're handling the refinement
    this.logger.info(`Applying refinement: "${userMessage}"`)

    // In a full implementation, you'd:
    // 1. Run user message through entity recognizer
    // 2. Determine what field is being updated
    // 3. Merge new entities with existing flow definition
    // 4. Re-validate with ResponsiblePlayValidator
  }

  /**
   * Generate appropriate follow-up questions based on what we know so far
   */
  private generateFollowUpQuestions(flow: Partial<FlowDefinition>): string[] {
    const questions: string[] = []

    // Check what we're missing
    if (!flow.trigger) {
      questions.push('When should this Flow run? (e.g., "every day at 3 PM", "once a day", "manually")')
    }

    if (!flow.rootNode) {
      questions.push('What actions should the Flow perform? (e.g., "open Chumba and claim my bonus")')
    }

    if (!flow.responsiblePlayGuardrails || flow.responsiblePlayGuardrails.length === 0) {
      questions.push('Do you want any safety limits? (e.g., "max 2 hours", "stop if I lose more than $50")')
    }

    // If we have questions, return just the next one
    return questions.length > 0 ? [questions[0]!] : []
  }

  /**
   * Check if a flow has all required fields
   */
  private isFlowComplete(flow: Partial<FlowDefinition>): boolean {
    return !!(
      flow.id &&
      flow.userId &&
      flow.name &&
      flow.description &&
      flow.trigger &&
      flow.rootNode &&
      flow.responsiblePlayGuardrails
    )
  }

  /**
   * List missing required fields
   */
  private getMissingFields(flow: Partial<FlowDefinition>): string[] {
    const missing: string[] = []

    if (!flow.trigger) missing.push('Trigger (when should it run?)')
    if (!flow.rootNode) missing.push('Actions (what should it do?)')
    if (!flow.responsiblePlayGuardrails || flow.responsiblePlayGuardrails.length === 0)
      missing.push('Safety guardrails (loss limits, max duration, etc.)')

    return missing
  }

  /**
   * Answer a user's question about the Flow system
   */
  private answerFlowQuestion(userMessage: string, _flow: Partial<FlowDefinition>): string {
    const lowerMessage = userMessage.toLowerCase()

    if (/what is|what are|explain/i.test(lowerMessage)) {
      if (/guardrail|safety|limit/i.test(lowerMessage)) {
        return 'Guardrails are safety limits that protect you. For example, "max 2 hours" stops the Flow after 2 hours, and "max loss of $50" stops if you lose $50. We require at least one guardrail on every Flow.'
      }
      if (/trigger|schedule|when/i.test(lowerMessage)) {
        return 'A trigger determines when your Flow runs. You can set it to run manually (on demand), on a schedule (like "daily at 3 PM"), or when an event happens (like when a new bonus is available).'
      }
      if (/loop|continue/i.test(lowerMessage)) {
        return 'A loop lets you repeat an action multiple times. For example, "keep spinning while I\'m up 5x my bonus" creates a loop that spins until that condition is met.'
      }
    }

    if (/how do|how to|how can/i.test(lowerMessage)) {
      return 'That\'s a great question! Can you be more specific about what you\'d like to do?'
    }

    return 'I\'m not sure I understood that. Could you clarify?'
  }

  /**
   * Generate a confirmation card showing the Flow summary
   */
  private generateConfirmationCard(flow: Partial<FlowDefinition>): string {
    let card = '```\n'

    // Trigger
    if (flow.trigger?.type === 'scheduled') {
      const scheduled = flow.trigger as any
      card += `⏰ Trigger: ${scheduled.cron} (${scheduled.timezone})\n`
    } else if (flow.trigger?.type === 'manual') {
      card += `⚙️ Trigger: Manual (on demand)\n`
    }

    // Add basic flow info
    card += `\n📋 Flow: ${flow.name || 'Untitled'}\n`

    if (flow.rootNode) {
      card += `✓ Actions defined\n`
    }

    if (flow.responsiblePlayGuardrails && flow.responsiblePlayGuardrails.length > 0) {
      card += `✓ Guardrails enabled\n`
      for (const guard of flow.responsiblePlayGuardrails) {
        if (guard.type === 'max_duration') {
          const hours = (guard.value as number) / (60 * 60 * 1000)
          card += `  • Max duration: ${hours} hours\n`
        }
      }
    }

    card += '```'
    return card
  }
}

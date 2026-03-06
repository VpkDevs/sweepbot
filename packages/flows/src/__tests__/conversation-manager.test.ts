import { describe, it, expect, beforeEach } from 'vitest'
import { ConversationManager } from '../conversation/conversation-manager'

describe('ConversationManager', () => {
  let conv: ConversationManager

  beforeEach(() => {
    conv = new ConversationManager()
  })

  it('should start a conversation and interpret initial description', async () => {
    const state = await conv.startConversation('userA', 'sess1', 'Every day at 5 PM, open Chumba and claim bonus')
    expect(state.userId).toBe('userA')
    expect(state.sessionId).toBe('sess1')
    expect(state.currentFlow).toBeDefined()
    // The interpreter should have added a trigger
    expect(state.currentFlow!.trigger?.type).toBe('scheduled')
    expect(state.turns[0]!.content).toContain('Every day')
  })

  it('should refine flow when user adds missing info', async () => {
    const state1 = await conv.startConversation('userB', 'sess2', 'Open Chumba')
    // initially no trigger
    expect(state1.currentFlow!.trigger?.type).not.toBe('scheduled')

    const state2 = await conv.continue('sess2', 'At 3 PM every day')
    expect(state2.currentFlow!.trigger?.type).toBe('scheduled')
    expect(state2.turns.length).toBeGreaterThan(1)

    // Ask a question
    const state3 = await conv.continue('sess2', 'What is a guardrail?')
    const lastTurn = state3.turns[state3.turns.length - 1]
    expect(lastTurn?.role).toBe('assistant')
    expect(lastTurn?.content).toMatch(/Guardrails are/)    
  })

  it('should confirm and return flow when complete', async () => {
    const conversationId = 'sess3'
    await conv.startConversation('userC', conversationId, 'Every day at 9 AM, open Chumba and play')
    let state = await conv.continue(conversationId, 'Looks good, activate')
    expect(['confirming','building'] as const).toContain(state.status as string) // status may flip depending on completion

    // manually set flow complete so confirm works
    state.currentFlow.id = 'flow123'
    state.currentFlow.userId = 'userC'
    state.currentFlow.name = 'test'
    state.currentFlow.description = 'desc'
    state.currentFlow.rootNode = { type: 'sequence', id: 'seq', steps: [] }
    state.currentFlow.responsiblePlayGuardrails = [{ type: 'max_duration', value: 0, source: 'system_default', overridable: true }]
    state.currentFlow.trigger = { type: 'manual' }

    const flow = await conv.confirm(conversationId)
    expect(flow).toBeDefined()
    expect(flow.id).toBe('flow123')
  })

  it('should generate pending questions when data missing', async () => {
    const state = await conv.startConversation('userD', 'sess4', 'Play the game')
    // no trigger → pending question asking for when to run
    expect(state.pendingQuestions.length).toBeGreaterThan(0)
    expect(state.pendingQuestions[0]).toMatch(/When should this Flow run/)
  })
})

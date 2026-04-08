import { describe, it, expect } from 'vitest'
import { FlowInterpreter } from './interpreter'
import type { FlowStep, NavigateStep, OpenGameStep } from './types'

describe('FlowInterpreter', () => {
  const interpreter = new FlowInterpreter()

  describe('PII Sanitization', () => {
    it('scrubs email addresses from the raw transcript', () => {
      const transcript = 'Login using john.doe@example.com and spin on Chumba.'
      const result = interpreter.interpret(transcript)

      expect(result.flow.description).not.toContain('john.doe@example.com')
      expect(result.flow.description).toContain('[EMAIL]')
    })

    it('scrubs phone numbers from the raw transcript', () => {
      const transcript = 'Call me at 555-019-2045 when we win.'
      const result = interpreter.interpret(transcript)

      expect(result.flow.description).not.toContain('555-019-2045')
      expect(result.flow.description).toContain('[PHONE]')
    })

    it('leaves safe text intact', () => {
      const transcript = 'Go to Pulsz and spin 10 times.'
      const result = interpreter.interpret(transcript)

      expect(result.flow.description).toBe('Go to Pulsz and spin 10 times.')
    })
  })

  describe('Responsible Play Defaults', () => {
    it('sets a default maximum duration to protect bankroll', () => {
      const transcript = 'Keep spinning on Sweet Bonanza forever.'
      const result = interpreter.interpret(transcript)

      expect(result.flow.limits?.maxDurationMs).toBeDefined()
      expect(result.flow.limits?.maxDurationMs).toBeLessThanOrEqual(60 * 60 * 1000)
    })

    it('sets a default max spins limit', () => {
      const transcript = 'Spin until I run out of money.'
      const result = interpreter.interpret(transcript)

      expect(result.flow.limits?.maxSpins).toBeDefined()
      expect(result.flow.limits?.maxSpins).toBe(500)
    })
  })

  describe('Entity Extraction', () => {
    it('identifies known platforms and games', () => {
      const transcript = 'Every morning at 8 am open High 5 Casino and look for Gates of Olympus'
      const result = interpreter.interpret(transcript)

      // The interpreter produces a navigate step with a url for the platform,
      // and an open_game step for the game.
      const navigateStep = result.flow.steps.find((s: FlowStep) => s.type === 'navigate') as NavigateStep | undefined
      expect(navigateStep).toBeDefined()
      expect(navigateStep?.url).toContain('high5casino')

      const openGameStep = result.flow.steps.find((s: FlowStep) => s.type === 'open_game') as OpenGameStep | undefined
      expect(openGameStep).toBeDefined()
      expect(openGameStep?.game).toBe('gates-of-olympus')
    })
  })
})

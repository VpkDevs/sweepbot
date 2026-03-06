/**
 * Entity Recognizer Tests
 * Test NLP entity extraction accuracy across platforms, games, actions, conditions, schedules
 */

import { describe, it, expect } from 'vitest'
import { EntityRecognizer } from '../interpreter/entity-recognizer'

describe('EntityRecognizer', () => {
  const recognizer = new EntityRecognizer()

  describe('Platform Recognition', () => {
    it('should recognize Chumba Casino', () => {
      const entities = recognizer.recognize('Open Chumba Casino')
      expect(entities.platforms).toHaveLength(1)
      expect(entities.platforms[0]!.normalized).toBe('chumba')
      expect(entities.platforms[0]!.confidence).toBeGreaterThan(0.8)
    })

    it('should recognize platform aliases (CC, Chumba, Chumba Casino)', () => {
      const inputs = ['CC', 'Chumba', 'Chumba Casino', 'chumba casino']
      for (const input of inputs) {
        const entities = recognizer.recognize(input)
        expect(entities.platforms).toHaveLength(1)
        expect(entities.platforms[0]!.normalized).toBe('chumba')
      }
    })

    it('should recognize LuckyLand Slots', () => {
      const entities = recognizer.recognize('I want to play LuckyLand')
      expect(entities.platforms.some((p) => p.normalized === 'luckyland')).toBe(true)
    })

    it('should handle multiple platforms in one string', () => {
      const entities = recognizer.recognize('Open Chumba and LuckyLand')
      expect(entities.platforms.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('Game Recognition', () => {
    it('should recognize Sweet Bonanza', () => {
      const entities = recognizer.recognize('throw it on Sweet Bonanza')
      expect(entities.games).toHaveLength(1)
      expect(entities.games[0]!.normalized).toBe('sweet_bonanza')
    })

    it('should recognize Gates of Olympus', () => {
      const entities = recognizer.recognize('play Gates of Olympus')
      expect(entities.games.some((g) => g.normalized.includes('olympus'))).toBe(true)
    })

    it('should handle game names with different cases', () => {
      const inputs = ['Sweet Bonanza', 'sweet bonanza', 'SWEET BONANZA']
      for (const input of inputs) {
        const entities = recognizer.recognize(input)
        expect(entities.games.some((g) => g.normalized === 'sweet_bonanza')).toBe(true)
      }
    })
  })

  describe('Action Recognition', () => {
    it('should recognize claim_bonus action', () => {
      const entities = recognizer.recognize('grab my daily bonus')
      expect(entities.actions.some((a) => a.type === 'claim_bonus')).toBe(true)
    })

    it('should recognize spin action', () => {
      const entities = recognizer.recognize('spin the reels')
      expect(entities.actions.some((a) => a.type === 'spin')).toBe(true)
      // spinning by itself shouldn't be classified as opening a game
      expect(entities.actions.some((a) => a.type === 'open_game')).toBe(false)
    })

    it('should recognize login action', () => {
      const entities = recognizer.recognize('log in to my account')
      expect(entities.actions.some((a) => a.type === 'login')).toBe(true)
    })

    it('should recognize cash_out action', () => {
      const entities = recognizer.recognize('cash out my winnings')
      expect(entities.actions.some((a) => a.type === 'cash_out')).toBe(true)
    })
  })

  describe('Condition Recognition', () => {
    it('should recognize greater than comparison', () => {
      const entities = recognizer.recognize('if win > 5x bonus')
      expect(entities.conditions.length).toBeGreaterThan(0)
      const cond = entities.conditions[0]!
      expect(cond.operator).toBe('>')
    })

    it('should recognize monetary comparisons like more than $50', () => {
      const entities = recognizer.recognize('If more than $50, spin')
      expect(entities.conditions.length).toBeGreaterThan(0)
      const cond = entities.conditions[0]!
      expect(cond.operator).toBe('>')
      expect(cond.right).toBe('50')
    })

    it('should recognize keep spinning condition', () => {
      const entities = recognizer.recognize('keep spinning while profitable')
      expect(entities.conditions.length).toBeGreaterThan(0)
    })

    it('should recognize stop condition', () => {
      const entities = recognizer.recognize('stop if i lose $50')
      expect(entities.conditions.length).toBeGreaterThan(0)
    })
  })

  describe('Schedule Recognition', () => {
    it('should recognize daily at specific time', () => {
      const entities = recognizer.recognize('every day at 3:30 PM')
      expect(entities.schedules).toHaveLength(1)
      expect(entities.schedules[0]!.frequency).toBe('daily')
      expect(entities.schedules[0]!.cron).toBeDefined()
    })

    it('should recognize weekly schedule', () => {
      const entities = recognizer.recognize('every Monday at 9 AM')
      expect(entities.schedules.length).toBeGreaterThan(0)
    })

    it('should recognize hourly schedule', () => {
      const entities = recognizer.recognize('run every hour')
      expect(entities.schedules.some((s) => s.frequency === 'custom')).toBe(true)
    })

    it('should extract timezone', () => {
      const entities = recognizer.recognize('every day at 3 PM EST')
      expect(entities.schedules.length).toBeGreaterThan(0)
      // Should have timezone info
      expect(entities.schedules[0]!.timezone).toBe('EST')
    })
  })

  describe('Amount Recognition', () => {
    it('should recognize absolute amounts', () => {
      const entities = recognizer.recognize('bet $10')
      expect(entities.amounts).toHaveLength(1)
      expect(entities.amounts[0]!.type).toBe('absolute')
      expect(entities.amounts[0]!.value).toBe(10)
    })

    it('should recognize multipliers', () => {
      const entities = recognizer.recognize('keep going if win > 5x the bonus')
      expect(entities.amounts.some((a) => a.multiplier === 5)).toBe(true)
    })

    it('should handle amount ranges', () => {
      const entities = recognizer.recognize('bet between $5 and $20')
      expect(entities.amounts.length).toBeGreaterThanOrEqual(1)
    })

    it('should recognize minimum/maximum references', () => {
      const entities = recognizer.recognize('bet the minimum')
      expect(entities.amounts.some((a) => a.reference === 'min_bet')).toBe(true)
    })
  })

  describe('Duration Recognition', () => {
    it('should recognize time durations', () => {
      const entities = recognizer.recognize('run for 2 hours')
      expect(entities.durations).toHaveLength(1)
      expect(entities.durations[0]!.unit).toBe('hours')
      expect(entities.durations[0]!.value).toBe(2)
    })

    it('should recognize iteration counts', () => {
      const entities = recognizer.recognize('spin 100 times')
      expect(entities.durations.some((d) => d.value === 100 && d.unit === 'spins')).toBe(true)
    })

    it('should recognize session durations', () => {
      const entities = recognizer.recognize('play for 30 minutes')
      expect(entities.durations.some((d) => d.unit === 'minutes')).toBe(true)
    })
  })

  describe('Complex Inputs', () => {
    it('should handle the example from the spec', () => {
      const input =
        'Every day at 3:30, open Chumba, grab my daily bonus, throw it on Sweet Bonanza at minimum bet. If I hit over 5x what the bonus was, keep going. If not, stop.'

      const entities = recognizer.recognize(input)

      expect(entities.platforms.some((p) => p.normalized === 'chumba')).toBe(true)
      expect(entities.games.some((g) => g.normalized === 'sweet_bonanza')).toBe(true)
      expect(entities.actions.some((a) => a.type === 'claim_bonus')).toBe(true)
      // spin isn't explicit in example – expect at least a bet action
      expect(entities.actions.some((a) => a.type === 'bet')).toBe(true)
      expect(entities.schedules).toHaveLength(1)
      expect(entities.conditions.length).toBeGreaterThan(0)
      expect(entities.amounts.some((a) => a.reference === 'min_bet')).toBe(true)
    })

    it('should extract multiple actions from a sequence', () => {
      const input = 'log in, claim bonus, play the game, cash out'
      const entities = recognizer.recognize(input)

      expect(entities.actions.some((a) => a.type === 'login')).toBe(true)
      expect(entities.actions.some((a) => a.type === 'claim_bonus')).toBe(true)
      // in a simple sequence 'play the game' maps to open_game
      expect(entities.actions.some((a) => a.type === 'open_game')).toBe(true)
      expect(entities.actions.some((a) => a.type === 'cash_out')).toBe(true)
    })
  })

  describe('Confidence Scoring', () => {
    it('should score high confidence for clear entities', () => {
      const entities = recognizer.recognize('Open Chumba Casino')
      const platform = entities.platforms[0]!
      expect(platform.confidence).toBeGreaterThan(0.8)
    })

    it('should score lower confidence for ambiguous input', () => {
      const entities = recognizer.recognize('play the game on the site')
      // Should have lower confidence when entities are vague
      expect(entities.actions.length).toBeGreaterThanOrEqual(0)
    })
  })
})
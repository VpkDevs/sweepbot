/**
 * Browser-safe Flow Interpreter.
 * Converts natural-language text → FlowDefinition using EntityRecognizer.
 * Pure TypeScript — zero external dependencies.
 */

import { EntityRecognizer } from './entity-recognizer'
import type {
  FlowDefinition,
  FlowStep,
  FlowTrigger,
  InterpretationResult,
  Condition,
  LoopStep,
  ClaimBonusStep,
  SpinStep,
} from './types'

// ─── Platform selectors (best-effort; user can override) ──────────────────────

export const PLATFORM_SELECTORS: Record<
  string,
  {
    loginButton?: string
    loginButtonText?: string
    bonusButton?: string
    bonusButtonText?: string
    bonusAmount?: string
    gameFrame?: string
    spinButton?: string
    spinButtonText?: string
    winAmount?: string
    balanceAmount?: string
  }
> = {
  chumba: {
    loginButton: '[data-testid="login-btn"], .login-button, a[href*="login"]',
    loginButtonText: 'Log In',
    bonusButton: '[data-testid="daily-bonus"], .bonus-claim-btn, .daily-reward-btn',
    bonusButtonText: 'Collect',
    bonusAmount: '.bonus-amount, [data-bonus-amount], .reward-coins',
    gameFrame: 'iframe[src*="game"], iframe.game-iframe',
    spinButton: '.spin-btn, [data-action="spin"], .spin-button',
    spinButtonText: 'Spin',
    winAmount: '.win-display, [data-win], .win-amount',
    balanceAmount: '.sc-balance, [data-sc-balance], .sweeps-coins-balance',
  },
  luckyland: {
    loginButtonText: 'Log In',
    bonusButtonText: 'Collect',
    spinButtonText: 'Spin',
  },
  stake: {
    loginButtonText: 'Sign In',
    bonusButtonText: 'Claim',
    spinButtonText: 'Spin',
  },
  // Generic fallback
  _default: {
    loginButtonText: 'Log In',
    bonusButtonText: 'Collect',
    spinButtonText: 'Spin',
  },
}

// ─── Interpreter ──────────────────────────────────────────────────────────────

export class FlowInterpreter {
  private recognizer = new EntityRecognizer()

  interpret(rawInput: string, _userId = 'anonymous'): InterpretationResult {
    const entities = this.recognizer.recognize(rawInput)
    const warnings: string[] = []
    const ambiguities: string[] = []

    // ── Confidence scoring ────────────────────────────────────────────────────

    let confidence = 0.3 // baseline
    if (entities.platforms.length > 0) confidence += 0.2
    if (entities.schedule !== null) confidence += 0.2
    if (entities.hasBonusClaim || entities.hasSpin) confidence += 0.15
    if (entities.multiplierThreshold !== null) confidence += 0.15

    // ── Build trigger ─────────────────────────────────────────────────────────

    const trigger: FlowTrigger = entities.schedule
      ? {
          type: 'scheduled',
          cron: entities.schedule.cron,
          timezone: entities.schedule.timezone,
          humanReadable: entities.schedule.humanReadable,
        }
      : { type: 'manual' }

    // ── Build steps ───────────────────────────────────────────────────────────

    const steps: FlowStep[] = []
    const platform =
      entities.platforms[0]?.canonical ?? null
    const platformUrl = entities.platforms[0]?.url ?? null
    const game = entities.games[0]?.canonical ?? null
    // 1. Navigate to platform
    if (platformUrl) {
      steps.push({ type: 'navigate', url: platformUrl, waitForLoad: true })
    } else if (platform) {
      ambiguities.push(`Unknown URL for platform "${platform}" — you may need to set it in Settings.`)
    }

    // 2. Login (if mentioned)
    if (entities.hasLogin && platform) {
      steps.push({
        type: 'login',
        platform,
        useStoredCredentials: true,
      })
      steps.push({ type: 'wait', ms: 2000, reason: 'Wait for login to complete' })
    }

    // 3. Claim bonus
    if (entities.hasBonusClaim) {
      const claimStep: ClaimBonusStep = {
        type: 'claim_bonus',
        platform: platform ?? 'unknown',
        storeAmountAs: 'bonusAmount',
      }
      steps.push(claimStep)
      steps.push({ type: 'wait', ms: 1500, reason: 'Wait for bonus animation' })
    }

    // 4. Open game
    if (game) {
      steps.push({ type: 'open_game', platform: platform ?? 'unknown', game })
      steps.push({ type: 'wait', ms: 3000, reason: 'Wait for game to load' })
    }

    // 5. Build spin logic with conditional loop
    if (entities.hasSpin) {
      const spinStep: SpinStep = {
        type: 'spin',
        storeWinAs: 'lastWin',
      }

      if (entities.multiplierThreshold !== null && entities.hasContinueOnWin) {
        // Loop: keep spinning while win >= N × bonus
        const loopCondition: Condition = {
          left: { kind: 'variable', name: 'lastWin' },
          operator: '>=',
          right: {
            kind: 'multiply',
            ref: { kind: 'variable', name: 'bonusAmount' },
            factor: entities.multiplierThreshold,
          },
        }

        const loopBody: FlowStep[] = [
          spinStep,
          { type: 'wait', ms: 2500, reason: 'Wait for spin result' },
        ]

        const loop: LoopStep = {
          type: 'loop',
          condition: loopCondition,
          body: loopBody,
          maxIterations: 200,
          maxDurationMs: 30 * 60 * 1000, // 30 min hard cap
        }

        // First spin (before the loop condition is checked)
        steps.push(spinStep)
        steps.push({ type: 'wait', ms: 2500, reason: 'Wait for first spin result' })
        steps.push(loop)

        steps.push({
          type: 'notify',
          title: 'SweepBot Flow Complete',
          message: entities.hasStopOnLoss
            ? `Stopped — win did not reach ${entities.multiplierThreshold}× bonus.`
            : 'Flow finished.',
        })
      } else {
        // Single spin
        steps.push(spinStep)
        steps.push({ type: 'wait', ms: 2500, reason: 'Wait for spin result' })
      }
    }

    // ── Warnings ──────────────────────────────────────────────────────────────

    if (!platform) {
      warnings.push('No platform detected. Add a platform name (e.g., "Chumba", "LuckyLand").')
    }
    if (!entities.schedule) {
      warnings.push('No schedule detected — flow will run manually only.')
    }
    if (confidence < 0.6) {
      warnings.push('Low confidence interpretation. Review the steps before activating.')
    }

    // ── Assemble flow ─────────────────────────────────────────────────────────

    const flow: FlowDefinition = {
      id: this.generateId(),
      name: this.generateName(entities, rawInput),
      description: rawInput,
      status: 'draft',
      trigger,
      steps,
      limits: {
        maxSpins: 500,
        maxDurationMs: 60 * 60 * 1000, // 1 hour hard cap
      },
      confidence,
      humanSummary: this.buildSummary(entities, platform, game, trigger),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      executionCount: 0,
    }

    return { flow, confidence, humanSummary: flow.humanSummary, warnings, ambiguities }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private generateId(): string {
    return `flow_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`
  }

  private generateName(
    entities: ReturnType<EntityRecognizer['recognize']>,
    rawInput: string,
  ): string {
    const parts: string[] = []
    if (entities.schedule) parts.push(entities.schedule.humanReadable)
    if (entities.platforms[0]) parts.push(entities.platforms[0].canonical)
    if (entities.hasBonusClaim) parts.push('bonus')
    if (entities.games[0]) parts.push(entities.games[0].canonical)
    if (entities.hasSpin) parts.push('spin')
    if (parts.length > 0) return parts.join(' › ')
    // Fallback: first 40 chars of input
    return rawInput.slice(0, 40) + (rawInput.length > 40 ? '…' : '')
  }

  private buildSummary(
    entities: ReturnType<EntityRecognizer['recognize']>,
    platform: string | null,
    game: string | null,
    trigger: FlowTrigger,
  ): string {
    const parts: string[] = []

    if (trigger.type === 'scheduled') {
      parts.push(`⏰ Runs ${trigger.humanReadable}`)
    } else {
      parts.push('▶️ Runs manually')
    }

    if (platform) parts.push(`🌐 Opens ${platform}`)
    if (entities.hasLogin) parts.push('🔑 Logs in')
    if (entities.hasBonusClaim) parts.push('🎁 Claims daily bonus → saves as bonusAmount')
    if (game) parts.push(`🎰 Opens ${game}`)

    if (entities.hasSpin && entities.multiplierThreshold !== null && entities.hasContinueOnWin) {
      parts.push(
        `🔄 Spins once, then loops while win ≥ ${entities.multiplierThreshold}× bonusAmount`,
      )
      if (entities.hasStopOnLoss) parts.push('🛑 Stops if win < threshold')
    } else if (entities.hasSpin) {
      parts.push('🎲 Spins once')
    }

    return parts.join('\n')
  }
}

// ─── Exported convenience singleton ──────────────────────────────────────────

export const flowInterpreter = new FlowInterpreter()

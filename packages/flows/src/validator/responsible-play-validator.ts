/**
 * Responsible Play Validator
 * CRITICAL: Every Flow MUST pass responsible play validation before activation
 * Non-negotiable guardrails are enforced here
 */

import type { FlowNode, ResponsiblePlayGuardrail } from '../types'

export class ResponsiblePlayValidator {
  validate(flowNode: FlowNode, userId: string, rawText?: string): ResponsiblePlayGuardrail[] {
    const guardrails: ResponsiblePlayGuardrail[] = []

    // 1. MAX SESSION DURATION - Default: 2 hours if not specified
    guardrails.push({
      type: 'max_duration',
      value: 2 * 60 * 60 * 1000,
      source: 'system_default',
      overridable: true,
    })

    // 2. COOL-DOWN ENFORCEMENT - System mandatory
    // IMPORTANT: this guardrail stores *policy* (whether to check), not *state*.
    // Current cooldown state must be provided at runtime by the caller/executor.
    guardrails.push({
      type: 'cool_down_check',
      value: true,
      source: 'system_mandatory',
      overridable: false,
    })

    if (rawText) {
      const lossMatch = rawText.match(/lose\s+more\s+than\s+\$?(\d+)/i)
      if (lossMatch) {
        guardrails.push({
          type: 'max_loss',
          value: parseFloat(lossMatch[1]!),
          source: 'user_specified',
          overridable: true,
        })
      }
      if (/double\s+my\s+bet|chase/i.test(rawText)) {
        guardrails.push({
          type: 'chase_detection',
          value: true,
          source: 'system_mandatory',
          overridable: false,
        })
      }
    }

    return guardrails
  }
}

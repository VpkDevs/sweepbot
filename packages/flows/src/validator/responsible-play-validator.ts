/**
 * Responsible Play Validator
 * CRITICAL: Every Flow MUST pass responsible play validation before activation
 * Non-negotiable guardrails are enforced here
 */

import type { FlowNode, ResponsiblePlayGuardrail } from '../types'

export class ResponsiblePlayValidator {
  validate(flowNode: FlowNode, userId: string): ResponsiblePlayGuardrail[] {
    const guardrails: ResponsiblePlayGuardrail[] = []

    // 1. MAX SESSION DURATION - Default: 2 hours if not specified
    guardrails.push({
      type: 'max_duration',
      value: 2 * 60 * 60 * 1000,
      source: 'system_default',
      overridable: true,
    })

    // 2. COOL-DOWN ENFORCEMENT - System mandatory
    guardrails.push({
      type: 'cool_down_check',
      value: true,
      source: 'system_mandatory',
      overridable: false,
    })

    return guardrails
  }
}

/**
 * Responsible Play Validator
 * CRITICAL: Every Flow MUST pass responsible play validation before activation
 * Non-negotiable guardrails are enforced here
 */
import type { FlowNode, ResponsiblePlayGuardrail } from '../types';
export declare class ResponsiblePlayValidator {
    validate(flowNode: FlowNode, userId: string): ResponsiblePlayGuardrail[];
}
//# sourceMappingURL=responsible-play-validator.d.ts.map
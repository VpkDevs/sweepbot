/**
 * Flow Interpreter - Main NLP interpretation service
 * Converts natural language input into a Flow Definition AST
 * Uses 4-pass interpretation: entity extraction, intent classification, logic structuring, validation
 */
import type { FlowInterpretationRequest, FlowInterpretationResult } from '../types';
export declare class FlowInterpreter {
    private entityRecognizer;
    interpret(request: FlowInterpretationRequest): Promise<FlowInterpretationResult>;
    /**
     * Pass 2: Classify the intent of the input
     * What type of automation is the user asking for?
     */
    private classifyIntent;
    /**
     * Pass 3: Build the Flow AST from entities and intent
     * Constructs a tree of nodes representing the automation logic
     */
    private buildFlowAST;
    /**
     * Build an "open platform" action node
     */
    private buildOpenPlatformNode;
    /**
     * Build an "open game" action node
     */
    private buildOpenGameNode;
    /**
     * Extract loop condition from text like "if win > 5x bonus, keep going"
     */
    private extractLoopCondition;
    /**
     * Build a spin loop node with condition
     */
    private buildSpinLoopNode;
    /**
     * Extract bet amount from entities
     */
    private extractBetAmount;
    /**
     * Pass 4: Validate responsible play constraints
     */
    private validateResponsiblePlay;
    /**
     * Extract the trigger from entities
     */
    private extractTrigger;
    /**
     * Calculate confidence score (0-1) based on entity extraction
     */
    private calculateConfidence;
    /**
     * Generate a human-readable summary of the flow
     */
    private generateSummary;
    /**
     * Recursively describe a node in human-readable format
     */
    private describeNode;
    /**
     * Convert a cron expression to human-readable text
     */
    private humanReadableCron;
    /**
     * Generate warnings for the flow
     */
    private generateWarnings;
    /**
     * Generate a name for the flow based on entities
     */
    private generateFlowName;
    /**
     * Generate a unique ID
     */
    private generateId;
}
//# sourceMappingURL=interpreter.d.ts.map